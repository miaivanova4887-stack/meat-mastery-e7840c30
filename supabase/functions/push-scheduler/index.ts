// Cron-invoked: process due push_campaign_runs. Sends current step via fcm-send,
// advances or marks done.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmToToken } from "../_shared/fcm.ts";
import { pickLocalized, normalizeLocale, type LocalizedString } from "../_shared/i18nStep.ts";
import { isCronAuthorized } from "../_shared/cronAuth.ts";
import { loadWeeklyProgress } from "../_shared/loadWeeklyProgress.ts";
import { suppressServerWeekly } from "../_shared/weeklyProgress.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const PreviewSchema = z.object({ mode: z.literal("preview") }).strict();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CampaignStep {
  delay_minutes?: number;
  title: LocalizedString;
  body?: LocalizedString;
  data?: Record<string, string>;
  preference_key?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const body = req.method === "POST" ? await req.json().catch(() => null) : null;
  if (body?.mode === "preview") {
    if (!PreviewSchema.safeParse(body).success) return json({ error: "Invalid preview request" }, 400);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("authorization");
    if (!anonKey || !authorization) return json({ error: "Sign in required" }, 401);
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Sign in required" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("timezone, locale").eq("id", user.id).maybeSingle();
    try {
      const summary = await loadWeeklyProgress(admin, user.id, new Date(), profile?.timezone || "UTC", profile?.locale || "en");
      return json({ ...summary, preview: true, sent: 0 });
    } catch (e) {
      console.error("[weekly-preview] read failed", String(e));
      return json({ error: "Weekly progress could not be read" }, 500);
    }
  }

  // Auth: service-role bearer token or the pg_cron shared token.
  if (!(await isCronAuthorized(req))) {
    return json({ error: "Forbidden" }, 403);
  }


  const admin = createClient(supabaseUrl, serviceKey);

  // Pull due runs with their campaigns
  const nowIso = new Date().toISOString();
  const { data: runs, error } = await admin
    .from("push_campaign_runs")
    .select("id, campaign_id, user_id, current_step, scheduled_for, push_campaigns(steps, active, schedule)")
    .eq("status", "pending")
    .lte("next_send_at", nowIso)
    .limit(200);
  if (error) {
    console.error(error);
    return json({ error: "Query failed" }, 500);
  }

  let processed = 0;
  let sent = 0;

  for (const run of runs ?? []) {
    processed++;
    // deno-lint-ignore no-explicit-any
    const campaign = (run as any).push_campaigns as { steps: CampaignStep[]; active: boolean; schedule?: { preference_key?: string } } | null;
    if (!campaign || !campaign.active) {
      await admin.from("push_campaign_runs")
        .update({ status: "cancelled" })
        .eq("id", run.id);
      continue;
    }
    const steps = Array.isArray(campaign.steps) ? campaign.steps : [];
    const idx = run.current_step;
    if (idx >= steps.length) {
      await admin.from("push_campaign_runs")
        .update({ status: "done" })
        .eq("id", run.id);
      continue;
    }
    const step = steps[idx];

    // Verify consent + preference
    const { data: profile } = await admin
      .from("profiles")
      .select("push_consent, notification_preferences, locale, timezone")
      .eq("id", run.user_id)
      .maybeSingle();
    if (!profile || profile.push_consent !== "granted") {
      await admin.from("push_campaign_runs")
        .update({ status: "cancelled", last_error: "no_consent" })
        .eq("id", run.id);
      continue;
    }
    if (step.preference_key) {
      const prefs = (profile.notification_preferences as Record<string, unknown>) || {};
      if (prefs[step.preference_key] !== true) {
        // Skip step but advance
        await scheduleNext(admin, run.id, idx, steps);
        continue;
      }
    }

    const locale = normalizeLocale(profile.locale as string | null);
    let localizedTitle = pickLocalized(step.title, locale);
    let localizedBody = pickLocalized(step.body, locale);
    const isWeekly = campaign.schedule?.preference_key === "weekly_summary";
    const occurrence = new Date(run.scheduled_for ?? nowIso);
    if (isWeekly) {
      // Scheduled campaign preference must still be enabled at delivery time.
      if (profile.notification_preferences?.weekly_summary !== true) {
        await scheduleNext(admin, run.id, idx, steps);
        continue;
      }
      try {
        const summary = await loadWeeklyProgress(admin, run.user_id, occurrence, profile.timezone || "UTC", locale);
        localizedTitle = summary.title;
        localizedBody = summary.body;
      } catch (e) {
        console.error("[weekly-summary] aggregation failed", String(e));
        await admin.from("push_campaign_runs").update({ last_error: "weekly_aggregation_failed" }).eq("id", run.id);
        continue; // Retry on next existing scheduler tick; never invent zero counts.
      }
    }

    // Get this user's FCM tokens
    const { data: tokens } = await admin
      .from("device_tokens")
      .select("token, platform, push_consent, notification_preferences, weekly_local_scheduled_for")
      .eq("user_id", run.user_id)
      .in("platform", ["android", "ios"]);

    if (!tokens || tokens.length === 0) {
      console.warn("[push-scheduler] no device token for user", run.user_id);
    }

    let stepSent = false;
    const invalidTokens: string[] = [];
    for (const t of tokens ?? []) {
      if (isWeekly && (t.push_consent !== "granted" || t.notification_preferences?.weekly_summary !== true ||
        suppressServerWeekly(t.weekly_local_scheduled_for, occurrence, "weekly_summary"))) continue;
      try {
        const r = await sendFcmToToken(
          t.token,
          { title: localizedTitle, body: localizedBody },
          isWeekly ? { ...step.data, path: "/progress", type: "weekly_summary" } : step.data,
        );
        if (r.ok) {
          stepSent = true;
          sent++;
        } else if (r.invalid) {
          invalidTokens.push(t.token);
        }
      } catch (e) {
        console.error("send err", e);
      }
    }
    if (invalidTokens.length) {
      await admin.from("device_tokens").delete().in("token", invalidTokens);
    }

    await scheduleNext(admin, run.id, idx, steps, stepSent ? null : "send_failed");
  }

  return json({ processed, sent });
});

// deno-lint-ignore no-explicit-any
async function scheduleNext(admin: any, runId: string, currentIdx: number, steps: CampaignStep[], lastError: string | null = null) {
  const nextIdx = currentIdx + 1;
  if (nextIdx >= steps.length) {
    await admin.from("push_campaign_runs")
      .update({ status: "done", current_step: nextIdx, last_error: lastError })
      .eq("id", runId);
    return;
  }
  const delayMin = steps[nextIdx].delay_minutes ?? 0;
  const next = new Date(Date.now() + delayMin * 60_000).toISOString();
  await admin.from("push_campaign_runs")
    .update({
      current_step: nextIdx,
      next_send_at: next,
      last_error: lastError,
    })
    .eq("id", runId);
}
