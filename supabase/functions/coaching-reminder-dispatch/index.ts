// supabase/functions/coaching-reminder-dispatch/index.ts
//
// Cron-driven coaching reminder dispatcher. Runs every 5 minutes.
// For each scheduled coaching session whose start time falls inside the
// user's chosen reminder window (and not yet logged in coaching_reminder_log),
// send a push notification across all registered native + web devices.

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

const WINDOW_MINUTES = 5; // tolerance around the reminder target

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const offsets = [15, 30, 60, 120, 1440];
  let sent = 0;
  let skipped = 0;

  // Resolve copy from CMS once per invocation; falls back to defaults if rows
  // are missing. Never throws.
  const copy = await loadReminderCopy(admin);


  for (const offset of offsets) {
    const target = new Date(now.getTime() + offset * 60_000);
    const lo = new Date(target.getTime() - WINDOW_MINUTES * 60_000).toISOString();
    const hi = new Date(target.getTime() + WINDOW_MINUTES * 60_000).toISOString();

    const { data: sessions, error } = await admin
      .from("coaching_sessions")
      .select("id, user_id, scheduled_at, timezone, booking_url")
      .eq("status", "scheduled")
      .gte("scheduled_at", lo)
      .lte("scheduled_at", hi);

    if (error) {
      console.error("[reminder] query failed", error);
      continue;
    }
    if (!sessions || sessions.length === 0) continue;

    for (const s of sessions) {
      try {
        // Already sent for this offset?
        const { data: existing } = await admin
          .from("coaching_reminder_log")
          .select("id")
          .eq("session_id", s.id)
          .eq("offset_minutes", offset)
          .maybeSingle();
        if (existing) { skipped++; continue; }

        // User opt-in + offset match
        const { data: profile } = await admin
          .from("profiles")
          .select("reminders_enabled, reminder_offset_minutes, display_name, locale")
          .eq("id", s.user_id)
          .maybeSingle();

        if (!profile || !profile.reminders_enabled) { skipped++; continue; }
        if (profile.reminder_offset_minutes !== offset) { skipped++; continue; }

        const title = profile.locale === "fr"
          ? "Rappel : appel de coaching"
          : "Coaching call reminder";
        const whenLocal = s.scheduled_at
          ? new Date(s.scheduled_at).toLocaleString(profile.locale === "fr" ? "fr-FR" : "en-US", {
              timeZone: s.timezone ?? undefined,
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
        const body = profile.locale === "fr"
          ? `Votre appel commence à ${whenLocal}.`
          : `Your call starts at ${whenLocal}.`;

        // Native FCM tokens
        const { data: tokens } = await admin
          .from("device_tokens")
          .select("token, platform")
          .eq("user_id", s.user_id);

        let okAny = false;
        let lastErr = "";

        for (const t of tokens ?? []) {
          try {
            const res = await sendFcmToToken(t.token, { title, body }, {
              type: "coaching_reminder",
              session_id: s.id,
              url: s.booking_url ?? "",
            });
            if (res.ok) okAny = true;
            else lastErr = res.error ?? `status ${res.status}`;
            if (res.invalid) {
              await admin.from("device_tokens").delete().eq("token", t.token);
            }
          } catch (e) {
            lastErr = (e as Error).message;
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
                  JSON.stringify({ title, body, url: s.booking_url ?? "/coaching" }),
                );
                okAny = true;
              } catch (e: any) {
                lastErr = e?.body ?? e?.message ?? "web-push failed";
                if (e?.statusCode === 410) {
                  await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
                }
              }
            }
          } catch (e) {
            lastErr = (e as Error).message;
          }
        }

        await admin.from("coaching_reminder_log").insert({
          session_id: s.id,
          user_id: s.user_id,
          offset_minutes: offset,
          channel: "push",
          success: okAny,
          error: okAny ? null : lastErr.slice(0, 500),
        });
        if (okAny) sent++;
      } catch (e) {
        console.error("[reminder] session loop failed", s.id, e);
      }
    }
  }

  console.info("[reminder] done", { sent, skipped });
  return json({ ok: true, sent, skipped });
});
