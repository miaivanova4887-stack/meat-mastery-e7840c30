import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { sendFcmToToken } from "../_shared/fcm.ts";

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

const SegmentSchema = z.object({
  diet_tier: z.array(z.string()).optional(),
  preference_key: z.string().optional(), // notification_preferences.<key> must be true
}).optional();

const BodySchema = z.object({
  user_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).optional(),
  segment: SegmentSchema,
  title: z.string().min(1).max(120),
  body: z.string().max(500).default(""),
  data: z.record(z.string()).optional(),
  // Allow internal callers (scheduler, event-trigger) to bypass admin check
  internal_secret: z.string().optional(),
});

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, SERVICE_ROLE_KEY);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  const body = parsed.data;

  // Auth: admin (via JWT) OR internal call (service role secret)
  let isAuthorized = false;
  if (body.internal_secret && body.internal_secret === SERVICE_ROLE_KEY) {
    isAuthorized = true;
  } else {
    const auth = req.headers.get("authorization");
    if (auth) {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: role } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (role) isAuthorized = true;
      }
    }
  }
  if (!isAuthorized) return json({ error: "Forbidden" }, 403);

  // Build candidate user_ids
  let userIds: string[] | null = null;
  if (body.user_id) userIds = [body.user_id];
  else if (body.user_ids?.length) userIds = body.user_ids;

  // Segmentation: filter profiles by consent, preferences, and attributes
  let profileQuery = admin
    .from("profiles")
    .select("id, notification_preferences, diet_tier")
    .eq("push_consent", "granted");
  if (userIds) profileQuery = profileQuery.in("id", userIds);
  if (body.segment?.diet_tier?.length) {
    profileQuery = profileQuery.in("diet_tier", body.segment.diet_tier);
  }
  const { data: profiles, error: profErr } = await profileQuery;
  if (profErr) {
    console.error("profiles query error", profErr);
    return json({ error: "Profile query failed" }, 500);
  }

  const prefKey = body.segment?.preference_key;
  const eligibleIds = (profiles ?? [])
    .filter((p) => {
      if (!prefKey) return true;
      const prefs = (p.notification_preferences as Record<string, unknown>) ||
        {};
      return prefs[prefKey] === true;
    })
    .map((p) => p.id);

  if (eligibleIds.length === 0) {
    return json({ sent: 0, failed: 0, eligible: 0 });
  }

  const { data: tokens, error: tokErr } = await admin
    .from("device_tokens")
    .select("token, user_id, platform")
    .in("user_id", eligibleIds);
  if (tokErr) {
    console.error("device_tokens query error", tokErr);
    return json({ error: "Token query failed" }, 500);
  }

  // Send only to FCM-routable platforms (android/ios). Web tokens (VAPID)
  // are handled by the existing push-notifications function.
  const fcmTokens = (tokens ?? []).filter((t) =>
    t.platform === "android" || t.platform === "ios"
  );

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const t of fcmTokens) {
    try {
      const r = await sendFcmToToken(
        t.token,
        { title: body.title, body: body.body },
        body.data,
      );
      if (r.ok) sent++;
      else {
        failed++;
        if (r.invalid) invalidTokens.push(t.token);
      }
    } catch (e) {
      failed++;
      console.error("send error", e);
    }
  }

  if (invalidTokens.length) {
    await admin.from("device_tokens").delete().in("token", invalidTokens);
  }

  return json({
    sent,
    failed,
    eligible: eligibleIds.length,
    fcm_tokens: fcmTokens.length,
    cleaned: invalidTokens.length,
  });
});
