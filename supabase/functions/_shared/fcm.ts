// Shared helper: send a push via FCM HTTP v1 using a service account JSON
// stored in the FIREBASE_SERVICE_ACCOUNT secret.

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedSa: ServiceAccount | null = null;

function getServiceAccount(): ServiceAccount {
  if (cachedSa) return cachedSa;
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
  cachedSa = JSON.parse(raw) as ServiceAccount;
  // TEMP DIAGNOSTIC: confirm which Firebase project this service account targets.
  // Safe to log — project_id and client_email are not secrets. Remove after verification.
  console.log(
    "[fcm] service account project_id=",
    cachedSa.project_id,
    "client_email=",
    cachedSa.client_email,
  );
  return cachedSa;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function base64UrlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuf));
  const jwt = `${signingInput}.${sigB64}`;

  const res = await fetch(payload.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

export interface FcmSendResult {
  token: string;
  ok: boolean;
  status: number;
  error?: string;
  invalid?: boolean; // 404 / UNREGISTERED / INVALID_ARGUMENT
}

export async function sendFcmToToken(
  token: string,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<FcmSendResult> {
  const sa = getServiceAccount();
  const accessToken = await getAccessToken();
  const url =
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const message = {
    message: {
      token,
      notification,
      data: data ?? {},
      android: { priority: "HIGH" },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  const text = await res.text();
  if (res.ok) return { token, ok: true, status: res.status };
  let invalid = false;
  try {
    const j = JSON.parse(text);
    const code = j?.error?.details?.[0]?.errorCode || j?.error?.status;
    if (
      code === "UNREGISTERED" ||
      code === "INVALID_ARGUMENT" ||
      res.status === 404
    ) {
      invalid = true;
    }
  } catch (_) {/* ignore */}
  return { token, ok: false, status: res.status, error: text, invalid };
}
