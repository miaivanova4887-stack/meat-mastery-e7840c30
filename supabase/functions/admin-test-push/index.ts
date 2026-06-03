// Sends a test push of a scheduled-campaign step to the calling admin's own
// device tokens only. Does NOT enqueue push_campaign_runs.

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

interface DraftStep {
  title?: LocalizedString;
  body?: LocalizedString;
  data?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Identify caller from their JWT.
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userRes.user.id;

  const admin = createClient(url, serviceKey);

  // Verify admin role.
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden" }, 403);

  let body: { campaignId?: string; locale?: string; draftStep?: DraftStep } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!body.campaignId) return json({ error: "campaignId required" }, 400);

  const locale = normalizeLocale(body.locale ?? "en");

  // Pull campaign for fallback content + name validation.
  const { data: campaign, error: cErr } = await admin
    .from("push_campaigns")
    .select("id, name, steps")
    .eq("id", body.campaignId)
    .maybeSingle();
  if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);

  // Prefer draftStep from client (live preview), else fall back to stored step 0.
  const step: DraftStep = body.draftStep ?? (campaign.steps as DraftStep[])?.[0] ?? {};
  const title = pickLocalized(step.title, locale) || "Test notification";
  const text = pickLocalized(step.body, locale) || campaign.name;

  // Fetch caller's FCM tokens.
  const { data: tokens } = await admin
    .from("device_tokens")
    .select("token")
    .eq("user_id", userId)
    .in("platform", ["android", "ios"]);

  let sent = 0;
  let invalid = 0;
  const dead: string[] = [];
  for (const t of tokens ?? []) {
    try {
      const r = await sendFcmToToken(t.token, { title, body: text }, {
        ...(step.data ?? {}),
        test: "1",
      });
      if (r.ok) sent++;
      else if (r.invalid) {
        invalid++;
        dead.push(t.token);
      }
    } catch (e) {
      console.error("test send err", e);
    }
  }
  if (dead.length) {
    await admin.from("device_tokens").delete().in("token", dead);
  }

  return json({ sent, invalid, tokens: tokens?.length ?? 0 });
});
