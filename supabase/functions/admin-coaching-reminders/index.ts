// supabase/functions/admin-coaching-reminders/index.ts
//
// Admin-only audit feed of coaching reminder push attempts (successes +
// failures). Reads coaching_reminder_log with service role after verifying
// caller's JWT and admin role.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(p: unknown, status = 200) {
  return new Response(JSON.stringify(p), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
  const userId = claimsData.claims.sub as string;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "all").toLowerCase();
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "200", 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 200 : limitRaw, 50), 500);

  let q = admin
    .from("coaching_reminder_log")
    .select("id, sent_at, offset_minutes, channel, success, error, session_id, user_id")
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (status === "success") q = q.eq("success", true);
  else if (status === "failure") q = q.eq("success", false);

  const { data: rows, error } = await q;
  if (error) {
    console.error("[admin-coaching-reminders] query failed", error);
    return json({ error: "Query failed" }, 500);
  }

  const sessionIds = Array.from(new Set((rows ?? []).map((r) => r.session_id).filter(Boolean)));
  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)));

  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    sessionIds.length
      ? admin
          .from("coaching_sessions")
          .select("id, scheduled_at, timezone, booking_url")
          .in("id", sessionIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length
      ? admin
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const sMap = new Map((sessions ?? []).map((s: any) => [s.id, s]));
  const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const out = (rows ?? []).map((r: any) => {
    const s = sMap.get(r.session_id);
    const p = pMap.get(r.user_id);
    return {
      id: r.id,
      sent_at: r.sent_at,
      offset_minutes: r.offset_minutes,
      channel: r.channel,
      success: r.success,
      error: r.error,
      session_id: r.session_id,
      user_id: r.user_id,
      user_email: p?.email ?? null,
      user_name: p?.display_name ?? null,
      scheduled_at: s?.scheduled_at ?? null,
      timezone: s?.timezone ?? null,
      booking_url: s?.booking_url ?? null,
    };
  });

  return json({ rows: out, count: out.length });
});
