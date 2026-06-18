// supabase/functions/coaching-unscheduled-nudge/index.ts
//
// Cron-driven dispatcher for the "paid but not yet scheduled" coaching state.
//
// Rules:
//   - Only acts on coaching_sessions.status = 'pending'.
//   - First nudge fires once the row is >= 15 minutes old (gives the user
//     time to finish booking on their own first).
//   - Follow-up nudges every 48h, capped at 4 total per row.
//   - Once the row moves to status='scheduled' (cal-webhook flip), this
//     function is a no-op and the existing coaching-reminder-dispatch takes
//     over for time-based reminders.
//
// Payload uses the same shape as coaching-reminder-dispatch so the existing
// push-tap deep-link plumbing routes the user to:
//   /profile?tab=settings&section=coaching&sessionId=<row id>
// where CoachingSessionsList highlights the "Action needed" card.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendFcmToToken } from "../_shared/fcm.ts";
import { loadReminderCopy, renderReminder } from "../_shared/reminderCopy.ts";
import webPush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(p: unknown, status = 200) {
  return new Response(JSON.stringify(p), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MIN_AGE_MINUTES = 15;
const FOLLOWUP_INTERVAL_HOURS = 48;
const MAX_NUDGES_PER_SESSION = 4;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Auth: require the service-role bearer token (Supabase cron / internal
  // callers only). Prevents unauthenticated callers from triggering batch
  // push notifications outside the cron schedule.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== serviceKey) {
    return json({ error: "Forbidden" }, 403);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );

  const copy = await loadReminderCopy(admin, "unscheduled");
  const nowMs = Date.now();
  const minCreatedAt = new Date(nowMs - MIN_AGE_MINUTES * 60_000).toISOString();
  const followupCutoff = new Date(nowMs - FOLLOWUP_INTERVAL_HOURS * 3600_000).toISOString();

  // Candidates: pending, older than 15 minutes, under the per-row cap, and
  // either never nudged or last nudge >= 48h ago.
  const { data: rows, error } = await admin
    .from("coaching_sessions")
    .select(
      "id, user_id, created_at, unscheduled_reminder_count, unscheduled_reminder_last_sent_at",
    )
    .eq("status", "pending")
    .lte("created_at", minCreatedAt)
    .lt("unscheduled_reminder_count", MAX_NUDGES_PER_SESSION)
    .or(`unscheduled_reminder_last_sent_at.is.null,unscheduled_reminder_last_sent_at.lte.${followupCutoff}`);

  if (error) {
    console.error("[unscheduled-nudge] query failed", error);
    return json({ error: "query failed" }, 500);
  }

  let sent = 0;
  let skipped = 0;

  for (const s of rows ?? []) {
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("reminders_enabled, locale, notification_preferences")
        .eq("id", s.user_id)
        .maybeSingle();

      if (!profile?.reminders_enabled) { skipped++; continue; }
      // Respect the coaching opt-in toggle.
      const prefs = (profile.notification_preferences ?? {}) as Record<string, unknown>;
      if (prefs.coaching === false) { skipped++; continue; }

      const locale = profile.locale === "fr" ? "fr" : "en";
      const { title, body } = renderReminder(copy, locale, "");
      const deepPath = `/profile?tab=settings&section=coaching&sessionId=${encodeURIComponent(s.id)}`;

      const dataPayload = {
        type: "coaching_unscheduled",
        target: "coaching_upcoming_session",
        session_id: s.id,
        path: deepPath,
        url: deepPath,
      };

      let okAny = false;

      // Native FCM
      const { data: tokens } = await admin
        .from("device_tokens")
        .select("token, platform")
        .eq("user_id", s.user_id);
      for (const t of tokens ?? []) {
        try {
          const res = await sendFcmToToken(t.token, { title, body }, dataPayload);
          if (res.ok) okAny = true;
          if (res.invalid) {
            await admin.from("device_tokens").delete().eq("token", t.token);
          }
        } catch (e) {
          console.warn("[unscheduled-nudge] fcm send failed", (e as Error).message);
        }
      }

      // Web push
      const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
      if (vapidPub && vapidPriv) {
        try {
          webPush.setVapidDetails("mailto:noreply@carnivorex.app", vapidPub, vapidPriv);
          const { data: subs } = await admin
            .from("push_subscriptions")
            .select("endpoint, keys_p256dh, keys_auth")
            .eq("user_id", s.user_id);
          for (const sub of subs ?? []) {
            try {
              await webPush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
                },
                JSON.stringify({ title, body, url: deepPath, data: dataPayload }),
              );
              okAny = true;
            } catch (e: any) {
              if (e?.statusCode === 410) {
                await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
            }
          }
        } catch (e) {
          console.warn("[unscheduled-nudge] web-push setup failed", (e as Error).message);
        }
      }

      if (okAny) {
        await admin
          .from("coaching_sessions")
          .update({
            unscheduled_reminder_count: (s.unscheduled_reminder_count ?? 0) + 1,
            unscheduled_reminder_last_sent_at: new Date().toISOString(),
          })
          .eq("id", s.id);
        sent++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.error("[unscheduled-nudge] row failed", s.id, e);
    }
  }

  console.info("[unscheduled-nudge] done", { sent, skipped, candidates: rows?.length ?? 0 });
  return json({ ok: true, sent, skipped, candidates: rows?.length ?? 0 });
});
