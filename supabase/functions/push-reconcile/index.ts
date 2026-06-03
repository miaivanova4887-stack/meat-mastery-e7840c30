// Scheduled push reconciler.
// Runs on cron (every 15 min). For each active scheduled campaign:
//   - computes today's local send instant per (timezone) bucket
//   - enqueues push_campaign_runs for eligible users (consent + pref toggle)
//   - idempotent via UNIQUE (campaign_id, user_id, scheduled_for)
//
// The existing push-scheduler then picks the runs up and sends them through
// fcm-send with locale-aware copy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Schedule {
  kind: "daily" | "weekly";
  local_time: string;            // "HH:MM"
  weekday?: number;              // 0=Sunday … 6=Saturday (weekly only)
  preference_key: string;
  use_profile_reminder_time?: boolean;
}

interface CampaignRow {
  id: string;
  schedule: Schedule;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Require service-role bearer (cron / internal).
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== serviceKey) {
    return json({ error: "Forbidden" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Pull active scheduled campaigns
  const { data: campaigns, error } = await admin
    .from("push_campaigns")
    .select("id, schedule")
    .eq("active", true)
    .eq("trigger_type", "scheduled");
  if (error) {
    console.error("campaign query", error);
    return json({ error: "campaign_query_failed" }, 500);
  }

  let enqueued = 0;
  let processed = 0;

  for (const c of (campaigns ?? []) as CampaignRow[]) {
    processed++;
    const sched = c.schedule || ({} as Schedule);
    if (!sched.kind || !sched.local_time || !sched.preference_key) continue;

    // Get all consent-granted users with the pref toggle on.
    // Filter by JSONB key in SQL to keep payload small.
    let profileQuery = admin
      .from("profiles")
      .select("id, timezone, notification_preferences")
      .eq("push_consent", "granted")
      .eq(`notification_preferences->>${sched.preference_key}`, "true");

    const { data: profiles, error: pErr } = await profileQuery;
    if (pErr) {
      console.error("profile query", pErr);
      continue;
    }

    for (const p of profiles ?? []) {
      const tz = (p.timezone as string) || "UTC";
      const prefs = (p.notification_preferences as Record<string, unknown>) || {};

      // Daily reminder may use user-customised reminder_time from preferences.
      const hhmm =
        sched.use_profile_reminder_time && typeof prefs.reminder_time === "string"
          ? (prefs.reminder_time as string)
          : sched.local_time;

      const occurrence = computeOccurrenceUtc(sched, hhmm, tz);
      if (!occurrence) continue;

      // Only enqueue if occurrence is in the recent past (now - 30min … now).
      // pg_cron runs every 15 min; window gives slack for one missed tick.
      const nowMs = Date.now();
      const ageMs = nowMs - occurrence.getTime();
      if (ageMs < 0 || ageMs > 30 * 60_000) continue;

      const { error: insErr } = await admin
        .from("push_campaign_runs")
        .insert({
          campaign_id: c.id,
          user_id: p.id,
          current_step: 0,
          scheduled_for: occurrence.toISOString(),
          next_send_at: new Date().toISOString(),
          status: "pending",
        });
      if (insErr) {
        // 23505 = unique violation → already enqueued for this occurrence
        // (idempotent path, expected on every cron tick after first hit).
        if (insErr.code !== "23505") {
          console.warn("enqueue err", c.id, p.id, insErr.message);
        }
      } else {
        enqueued++;
      }
    }
  }

  return json({ ok: true, processed, enqueued });
});

/**
 * Returns the UTC instant for today's (or this week's) scheduled send,
 * computed against the user's local timezone wall clock.
 *
 * Daily   → today at HH:MM local
 * Weekly  → if today is the configured weekday, this week at HH:MM local;
 *           otherwise null (will fire on the next occurrence)
 */
function computeOccurrenceUtc(
  sched: Schedule,
  hhmm: string,
  timezone: string,
): Date | null {
  const [hStr, mStr] = (hhmm || "").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  // Get current local Y/M/D + weekday in the user's tz.
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(new Date());
  } catch {
    return null; // invalid tz
  }
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[map.weekday] ?? -1;

  if (sched.kind === "weekly" && sched.weekday !== undefined && weekday !== sched.weekday) {
    return null;
  }

  // Build "today HH:MM" in target tz, expressed as UTC instant.
  return localWallClockToUtc(year, month, day, h, m, timezone);
}

/** Convert a wall-clock Y/M/D HH:MM in a given IANA tz to a UTC Date. */
function localWallClockToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number, timezone: string,
): Date {
  // Start with the naive UTC interpretation, then correct by the tz offset.
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const asLocal = new Date(naive);
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(asLocal);
  const tzMap: Record<string, string> = {};
  for (const p of tzParts) tzMap[p.type] = p.value;
  const tzAsUtc = Date.UTC(
    Number(tzMap.year), Number(tzMap.month) - 1, Number(tzMap.day),
    Number(tzMap.hour === "24" ? "0" : tzMap.hour),
    Number(tzMap.minute), Number(tzMap.second),
  );
  const offsetMs = tzAsUtc - naive;
  return new Date(naive - offsetMs);
}
