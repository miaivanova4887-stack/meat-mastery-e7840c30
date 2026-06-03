// Cron-invoked: process due push_campaign_runs. Sends current step via fcm-send,
// advances or marks done.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmToToken } from "../_shared/fcm.ts";
import { pickLocalized, normalizeLocale, type LocalizedString } from "../_shared/i18nStep.ts";

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

  // Auth: require service-role bearer token (Supabase cron / internal callers).
  // Prevents unauthenticated callers from triggering batch FCM sends.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== serviceKey) {
    return json({ error: "Forbidden" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Pull due runs with their campaigns
  const nowIso = new Date().toISOString();
  const { data: runs, error } = await admin
    .from("push_campaign_runs")
    .select("id, campaign_id, user_id, current_step, push_campaigns(steps, active)")
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
    const campaign = (run as any).push_campaigns as { steps: CampaignStep[]; active: boolean } | null;
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
      .select("push_consent, notification_preferences, locale")
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
    const localizedTitle = pickLocalized(step.title, locale);
    const localizedBody = pickLocalized(step.body, locale);

    // Get this user's FCM tokens
    const { data: tokens } = await admin
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", run.user_id)
      .in("platform", ["android", "ios"]);

    let stepSent = false;
    const invalidTokens: string[] = [];
    for (const t of tokens ?? []) {
      try {
        const r = await sendFcmToToken(
          t.token,
          { title: localizedTitle, body: localizedBody },
          step.data,
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
