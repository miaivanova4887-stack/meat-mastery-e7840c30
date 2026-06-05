// supabase/functions/coaching-reminder-test/index.ts
//
// Send a one-off "test" coaching reminder push to the authenticated user's own
// devices (native FCM + web push). Validates the caller's JWT, enforces a
// simple per-user rate limit, and does NOT write to coaching_reminder_log
// (keeps the admin audit clean).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendFcmToToken } from "../_shared/fcm.ts";
import { loadReminderCopy, renderReminder } from "../_shared/reminderCopy.ts";
import webPush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(p: unknown, status = 200) {
  return new Response(JSON.stringify(p), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// In-memory per-user rate limit: at most 1 test send per 30s.
const lastSend = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Admin-only gate (enforced server-side; frontend also hides the button)
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    console.warn("[reminder-test] forbidden non-admin", { userId });
    return json({ ok: false, code: "forbidden", error: "Admins only" }, 403);
  }

  const last = lastSend.get(userId) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) {
    return json({ ok: false, code: "rate_limited", error: "Please wait before sending another test." }, 429);
  }
  lastSend.set(userId, Date.now());

  const { data: profile } = await admin
    .from("profiles")
    .select("locale, timezone, push_consent")
    .eq("id", userId)
    .maybeSingle();

  const tz = profile?.timezone ?? undefined;
  const locale = profile?.locale === "fr" ? "fr" : "en";
  const pushConsent = profile?.push_consent ?? "unset";

  if (pushConsent === "denied") {
    console.info("[reminder-test] permission_denied", { userId });
    return json({ ok: false, code: "permission_denied", pushConsent, delivered: 0, devices: 0 }, 200);
  }

  const fakeStart = new Date(Date.now() + 5 * 60_000);
  const whenLocal = (() => {
    try {
      return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
      }).format(fakeStart);
    } catch {
      return fakeStart.toISOString();
    }
  })();

  const copy = await loadReminderCopy(admin);
  const { title, body } = renderReminder(copy, locale, whenLocal);

  let deliveredNative = 0;
  let deliveredWeb = 0;
  const errors: string[] = [];

  const { data: tokens } = await admin
    .from("device_tokens")
    .select("token, platform")
    .eq("user_id", userId);

  const testPath = "/profile?tab=settings&section=coaching";
  for (const t of tokens ?? []) {
    try {
      const res = await sendFcmToToken(t.token, { title, body }, {
        type: "coaching_reminder_test",
        target: "coaching_upcoming_session",
        path: testPath,
        url: testPath,
      });
      if (res.ok) deliveredNative++;
      else errors.push(`fcm:${res.error ?? `status ${res.status}`}`);
      if (res.invalid) {
        await admin.from("device_tokens").delete().eq("token", t.token);
      }
    } catch (e) {
      errors.push(`fcm:${(e as Error).message}`);
    }
  }

  let webSubCount = 0;
  let fcmAttempts = 0;
  let webAttempts = 0;
  fcmAttempts = (tokens ?? []).length;

  const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!vapidPub || !vapidPriv) {
    console.warn("[reminder-test] VAPID not configured — web push skipped");
  } else {
    try {
      webPush.setVapidDetails("mailto:noreply@carnivorex.app", vapidPub, vapidPriv);
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("endpoint, keys_p256dh, keys_auth")
        .eq("user_id", userId);
      webSubCount = (subs ?? []).length;
      webAttempts = webSubCount;
      for (const sub of subs ?? []) {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            JSON.stringify({ title, body, url: "/coaching" }),
          );
          deliveredWeb++;
        } catch (e: any) {
          errors.push(`web:${e?.body ?? e?.message ?? "web-push failed"}`);
          if (e?.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    } catch (e) {
      errors.push(`web:${(e as Error).message}`);
    }
  }

  const totalDevices = fcmAttempts + webSubCount;
  const totalDelivered = deliveredNative + deliveredWeb;

  // Determine structured outcome code. We always return HTTP 200 for these
  // expected outcomes so the frontend reliably parses `data.code` (non-2xx
  // bodies are placed on FunctionsHttpError.context, not `data`).
  let code: string;
  const httpStatus = 200;
  if (totalDevices === 0) {
    code = "no_devices";
  } else if (totalDelivered === 0) {
    const fcmFailed = fcmAttempts > 0 && deliveredNative === 0;
    const webFailed = webAttempts > 0 && deliveredWeb === 0;
    if (fcmFailed && !webFailed) code = "fcm_failed";
    else if (webFailed && !fcmFailed) code = "web_push_failed";
    else code = "send_failed";
  } else if (totalDelivered < totalDevices) {
    code = "partial_success";
  } else {
    code = "ok";
  }

  console.info("[reminder-test] sent", {
    userId,
    code,
    pushConsent,
    deliveredNative,
    deliveredWeb,
    fcmAttempts,
    webAttempts,
    errors: errors.length,
  });

  return json({
    ok: totalDelivered > 0,
    code,
    deliveredNative,
    deliveredWeb,
    delivered: totalDelivered,
    devices: totalDevices,
    fcmAttempts,
    webAttempts,
    pushConsent,
    title,
    body,
    errors: errors.slice(0, 5),
  }, httpStatus);
});

