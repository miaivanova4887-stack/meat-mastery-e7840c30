// Account deletion endpoint — required by App Store Guideline 5.1.1(v).
// Authenticated user calls this to permanently delete their account and
// all associated rows. If Apple Sign In token revocation secrets are
// configured, we also revoke the Apple refresh token per Apple's rules.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const extra = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DELETE-ACCOUNT] ${step}${extra}`);
};

// User-owned tables to clear. Each is best-effort — a missing table or
// permissions issue must NEVER stop the auth.users delete from happening.
const USER_TABLES: { table: string; column: string }[] = [
  { table: "recipe_likes", column: "user_id" },
  { table: "post_likes", column: "user_id" },
  { table: "community_recipes", column: "user_id" },
  { table: "community_posts", column: "user_id" },
  { table: "progress_entries", column: "user_id" },
  { table: "progress_goals", column: "user_id" },
  { table: "user_attributes", column: "user_id" },
  { table: "device_tokens", column: "user_id" },
  { table: "push_subscriptions", column: "user_id" },
  { table: "meal_plans", column: "user_id" },
  { table: "favorites", column: "user_id" },
  { table: "user_roles", column: "user_id" },
  { table: "profiles", column: "id" },
];


// --- Apple Sign In revocation -------------------------------------------
// Apple requires SiwA users to be able to fully revoke their Apple tokens
// when deleting their account. We sign a client-secret JWT and POST to
// https://appleid.apple.com/auth/revoke. All Apple secrets are optional —
// when missing we log a warning and continue (DB-side deletion still runs).

async function buildAppleClientSecret(): Promise<string | null> {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !keyId || !bundleId || !privateKeyPem) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 5,
    aud: "https://appleid.apple.com",
    sub: bundleId,
  };
  const b64url = (data: ArrayBuffer | string) => {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  // Import the .p8 PEM as an ES256 private key.
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(sig)}`;
}

async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  const clientSecret = await buildAppleClientSecret();
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
  if (!clientSecret || !bundleId) return false;
  const body = new URLSearchParams({
    client_id: bundleId,
    client_secret: clientSecret,
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
  const res = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    log("apple-revoke-failed", { status: res.status, body: await res.text() });
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error(`Auth: ${userError?.message ?? "no user"}`);
    const userId = userData.user.id;
    log("user-authenticated", { userId });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Try to revoke Sign In with Apple token if applicable.
    try {
      const identities = (userData.user as any).identities as
        | Array<{ provider: string; identity_data?: Record<string, unknown> }>
        | undefined;
      const apple = identities?.find((i) => i.provider === "apple");
      const appleRefresh =
        (apple?.identity_data as Record<string, string> | undefined)?.["provider_refresh_token"] ||
        (apple?.identity_data as Record<string, string> | undefined)?.["refresh_token"];
      if (apple) {
        if (appleRefresh) {
          const ok = await revokeAppleToken(appleRefresh);
          log("apple-revoke", { ok });
        } else {
          log("apple-no-refresh-token");
        }
      }
    } catch (e) {
      log("apple-revoke-threw", { message: String(e) });
    }

    // 2) Best-effort wipe of user-owned rows.
    for (const { table, column } of USER_TABLES) {
      try {
        const { error } = await admin.from(table).delete().eq(column, userId);
        if (error) log("delete-row-failed", { table, error: error.message });
      } catch (e) {
        log("delete-row-threw", { table, message: String(e) });
      }
    }

    // 3) Delete the auth user (cascades any remaining auth.* rows).
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`Auth delete failed: ${delErr.message}`);
    log("user-deleted", { userId });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
