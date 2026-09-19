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
  token: z.string().min(10).max(4096),
  platform: z.enum(["android", "ios", "web"]),
  app_version: z.string().max(64).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(16).optional(),
});

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Session is OPTIONAL: push delivery is gated by consent, not sign-in.
  // When a valid session is present we link the token to that user; without
  // one the token is stored anonymously (user_id NULL).
  const auth = req.headers.get("authorization");
  let userId: string | null = null;
  if (auth) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    } catch (e) {
      console.warn("[register-device-token] auth check failed — treating as anonymous", String(e));
    }
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  const { token, platform, app_version } = parsed.data;
  const timezone = parsed.data.timezone && isValidTimezone(parsed.data.timezone)
    ? parsed.data.timezone
    : "UTC";
  const locale = parsed.data.locale?.toLowerCase().startsWith("fr") ? "fr" : "en";

  const admin = createClient(supabaseUrl, serviceKey);
  const nowIso = new Date().toISOString();

  // Upsert keyed on token. An anonymous registration must never clear an
  // existing user link; a signed-in registration always claims the token.
  const { data: existing } = await admin
    .from("device_tokens")
    .select("id, user_id")
    .eq("token", token)
    .maybeSingle();

  let error;
  if (existing) {
    const patch: Record<string, unknown> = {
      platform,
      app_version: app_version ?? null,
      timezone,
      locale,
      last_seen_at: nowIso,
    };
    if (userId) patch.user_id = userId;
    ({ error } = await admin.from("device_tokens").update(patch).eq("id", existing.id));
  } else {
    ({ error } = await admin.from("device_tokens").insert({
      user_id: userId,
      token,
      platform,
      app_version: app_version ?? null,
      timezone,
      locale,
      last_seen_at: nowIso,
    }));
  }

  if (error) {
    console.error("register-device-token upsert error", error);
    return json({ error: "Insert failed" }, 500);
  }

  // Safety net: a device registered against a profile with no notification
  // preferences would never match any scheduled campaign. Seed defaults once.
  if (userId) {
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("notification_preferences")
        .eq("id", userId)
        .maybeSingle();
      const prefs = (profile?.notification_preferences ?? {}) as Record<string, unknown>;
      if (Object.keys(prefs).length === 0) {
        await admin.from("profiles").update({
          notification_preferences: {
            daily_meal_reminder: true,
            reminder_time: "19:00",
            streak_reminder: true,
            weekly_summary: true,
            recipe_ideas: true,
            fasting_updates: true,
            coaching_tips: true,
            marketing: false,
          },
        }).eq("id", userId);
        console.log("[register-device-token] seeded default notification prefs", userId);
      }
    } catch (e) {
      console.warn("[register-device-token] prefs seed skipped", String(e));
    }
  }

  return json({ ok: true, anonymous: !userId });
});
