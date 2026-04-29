// When called, finds active campaigns whose trigger matches the event
// and enqueues a campaign run for the user (idempotent per campaign+user).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

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

const BodySchema = z.object({
  event_name: z.string().min(1).max(64),
  event_data: z.record(z.unknown()).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  const { event_name } = parsed.data;

  const admin = createClient(supabaseUrl, serviceKey);

  // Skip if user hasn't granted consent
  const { data: profile } = await admin
    .from("profiles")
    .select("push_consent")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.push_consent !== "granted") {
    return json({ ok: true, skipped: "no_consent" });
  }

  // Find active event campaigns matching this event
  const { data: campaigns, error } = await admin
    .from("push_campaigns")
    .select("id, trigger_config")
    .eq("active", true)
    .eq("trigger_type", "event");
  if (error) {
    console.error(error);
    return json({ error: "Query failed" }, 500);
  }

  const matched = (campaigns ?? []).filter((c) => {
    const cfg = (c.trigger_config as Record<string, unknown>) || {};
    return cfg.event === event_name;
  });

  if (!matched.length) return json({ ok: true, enqueued: 0 });

  // Enqueue runs (UNIQUE constraint on (campaign_id,user_id) keeps idempotent)
  const rows = matched.map((c) => ({
    campaign_id: c.id,
    user_id: user.id,
    current_step: 0,
    next_send_at: new Date().toISOString(),
    status: "pending",
  }));

  const { error: insErr } = await admin
    .from("push_campaign_runs")
    .upsert(rows, { onConflict: "campaign_id,user_id", ignoreDuplicates: true });
  if (insErr) {
    console.error(insErr);
    return json({ error: "Enqueue failed" }, 500);
  }

  return json({ ok: true, enqueued: rows.length });
});
