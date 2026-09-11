// TEMPORARY diagnostic: verifies the FIREBASE_SERVICE_ACCOUNT credential can
// mint a Google access token and reach FCM. Sends nothing real (validate_only
// against a dummy token). Requires the internal cron token.
//
// Delete after verification.

import { isCronAuthorized } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64url(input: Uint8Array | string): string {
  const b = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToBuf(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!(await isCronAuthorized(req))) return json({ error: "Forbidden" }, 403);

  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return json({ ok: false, stage: "secret", error: "FIREBASE_SERVICE_ACCOUNT not set" }, 500);

  let sa: { client_email: string; private_key: string; project_id: string; token_uri?: string };
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    return json({ ok: false, stage: "parse", error: String(e) }, 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const signingInput = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${
    b64url(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud,
      iat: now,
      exp: now + 3600,
    }))
  }`;

  let accessToken: string;
  try {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToBuf(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput),
    );
    const res = await fetch(aud, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${signingInput}.${b64url(new Uint8Array(sig))}`,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return json({ ok: false, stage: "token", status: res.status, error: text }, 500);
    }
    accessToken = JSON.parse(text).access_token;
  } catch (e) {
    return json({ ok: false, stage: "sign", error: String(e) }, 500);
  }

  const fcmRes = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validate_only: true,
        message: {
          token: "dummy-token-for-credential-check",
          notification: { title: "check", body: "check" },
        },
      }),
    },
  );
  const fcmText = await fcmRes.text();

  return json({
    ok: true,
    project_id: sa.project_id,
    client_email: sa.client_email,
    token_minted: true,
    fcm_status: fcmRes.status,
    fcm_response: fcmText.slice(0, 500),
  });
});
