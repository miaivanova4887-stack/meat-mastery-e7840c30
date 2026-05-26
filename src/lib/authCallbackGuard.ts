/**
 * Shared guard + handoff between the deep-link layer and AuthCallback.
 *
 * The previous module-level dedupe only survived a single JS runtime; iOS
 * was restarting the WebView between callback re-deliveries, which reset
 * the flags and reproduced the history.replaceState loop. This module now
 * persists the dedupe state and the raw callback URL through sessionStorage
 * + localStorage so the loop cannot restart after a runtime reset, while
 * staying resilient when storage is unavailable.
 */

let inProgress = false;

export function beginAuthCallback() {
  inProgress = true;
}

export function endAuthCallback() {
  inProgress = false;
}

export function isAuthCallbackInProgress(): boolean {
  return inProgress;
}

/* ------------------------------------------------------------------ */
/*  Persistent dedupe + raw-callback handoff                          */
/* ------------------------------------------------------------------ */

const COMPLETED_KEY = "auth-cb-completed-v1";
const HANDOFF_KEY = "auth-cb-handoff-v1";
const COMPLETED_TTL_MS = 10 * 60 * 1000; // 10 minutes
const HANDOFF_TTL_MS = 2 * 60 * 1000;    // 2 minutes

// In-memory mirrors so a single runtime still dedupes even if storage is
// blocked (private mode, quota errors, etc).
const memCompleted = new Map<string, number>();
let memHandoff: { url: string; ts: number } | null = null;

function safeGet(storage: Storage | null, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function safeSet(storage: Storage | null, key: string, value: string): void {
  try { storage?.setItem(key, value); } catch { /* noop */ }
}
function safeRemove(storage: Storage | null, key: string): void {
  try { storage?.removeItem(key); } catch { /* noop */ }
}

function getLS(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}
function getSS(): Storage | null {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

/**
 * Stable fingerprint for an OAuth/email callback URL. We hash on the
 * access_token / refresh_token / code / token_hash values so the same
 * callback delivered as carnivorex://callback#... and capacitor://localhost/
 * callback#... resolves to a single fingerprint.
 */
export function callbackFingerprint(rawUrl: string): string {
  if (!rawUrl) return "empty";
  const grab = (s: string, name: string): string | null => {
    const m = s.match(new RegExp(`[#&?]${name}=([^&]+)`));
    return m ? m[1] : null;
  };
  const at = grab(rawUrl, "access_token");
  const rt = grab(rawUrl, "refresh_token");
  const code = grab(rawUrl, "code");
  const th = grab(rawUrl, "token_hash");
  if (at) return "at:" + at.slice(0, 48);
  if (code) return "code:" + code.slice(0, 48);
  if (th) return "th:" + th.slice(0, 48);
  if (rt) return "rt:" + rt.slice(0, 32);
  // Fall back to the hash/query content
  const h = rawUrl.indexOf("#");
  const q = rawUrl.indexOf("?");
  if (h >= 0) return "h:" + rawUrl.slice(h + 1, h + 64);
  if (q >= 0) return "q:" + rawUrl.slice(q + 1, q + 64);
  return "u:" + rawUrl.slice(0, 64);
}

function readCompletedMap(): Map<string, number> {
  const raw = safeGet(getLS(), COMPLETED_KEY);
  const out = new Map<string, number>(memCompleted);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      for (const [fp, ts] of Object.entries(parsed)) out.set(fp, ts);
    } catch { /* noop */ }
  }
  // Drop expired entries
  const now = Date.now();
  for (const [fp, ts] of out) {
    if (now - ts > COMPLETED_TTL_MS) out.delete(fp);
  }
  return out;
}

function writeCompletedMap(map: Map<string, number>): void {
  const obj: Record<string, number> = {};
  for (const [fp, ts] of map) obj[fp] = ts;
  safeSet(getLS(), COMPLETED_KEY, JSON.stringify(obj));
  memCompleted.clear();
  for (const [fp, ts] of map) memCompleted.set(fp, ts);
}

export function isCallbackCompleted(fp: string): boolean {
  return readCompletedMap().has(fp);
}

export function markCallbackCompleted(fp: string): void {
  const map = readCompletedMap();
  map.set(fp, Date.now());
  writeCompletedMap(map);
}

/* ------------------------------------------------------------------ */
/*  Handoff: raw native callback URL → AuthCallback                   */
/* ------------------------------------------------------------------ */

export function storeCallbackHandoff(rawUrl: string): void {
  const payload = JSON.stringify({ url: rawUrl, ts: Date.now() });
  memHandoff = { url: rawUrl, ts: Date.now() };
  safeSet(getSS(), HANDOFF_KEY, payload);
}

export function consumeCallbackHandoff(): string | null {
  let raw = safeGet(getSS(), HANDOFF_KEY);
  let parsed: { url: string; ts: number } | null = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!parsed && memHandoff) parsed = memHandoff;
  if (!parsed) return null;
  if (Date.now() - parsed.ts > HANDOFF_TTL_MS) {
    clearCallbackHandoff();
    return null;
  }
  return parsed.url;
}

export function clearCallbackHandoff(): void {
  memHandoff = null;
  safeRemove(getSS(), HANDOFF_KEY);
}

/* ------------------------------------------------------------------ */
/*  normalizeAuthCallbackUrl (unchanged)                              */
/* ------------------------------------------------------------------ */

export type NormalizedCallback = {
  protocol: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
  normalizedPath: string;
  isAuthRoute: boolean;
};

export function normalizeAuthCallbackUrl(rawUrl: string): NormalizedCallback {
  let protocol = "";
  let host = "";
  let pathname = "";
  let search = "";
  let hash = "";

  try {
    const u = new URL(rawUrl);
    protocol = u.protocol.replace(":", "");
    host = u.hostname;
    pathname = u.pathname;
    search = u.search;
    hash = u.hash;
  } catch {
    /* handled by raw-string fallback */
  }

  if (!protocol && rawUrl.startsWith("carnivorex:")) {
    protocol = "carnivorex";
  }
  if (rawUrl.startsWith("carnivorex:///callback")) {
    host = host || "";
    pathname = "/callback";
    const hashIdx = rawUrl.indexOf("#");
    const qIdx = rawUrl.indexOf("?");
    if (hashIdx >= 0) hash = hash || rawUrl.slice(hashIdx);
    if (qIdx >= 0 && (hashIdx < 0 || qIdx < hashIdx)) {
      search = search || rawUrl.slice(qIdx, hashIdx >= 0 ? hashIdx : undefined);
    }
  }

  let normalizedPath = pathname || "/";
  let isAuthRoute = false;

  if (protocol === "carnivorex") {
    if (host === "callback") {
      normalizedPath = "/callback";
      isAuthRoute = true;
    } else if (host === "auth" && pathname.startsWith("/callback")) {
      normalizedPath = "/auth/callback";
      isAuthRoute = true;
    } else if (!host && pathname.startsWith("/callback")) {
      normalizedPath = "/callback";
      isAuthRoute = true;
    } else if (pathname.startsWith("/reset-password")) {
      normalizedPath = "/reset-password";
      isAuthRoute = true;
    }
  } else {
    if (
      pathname.startsWith("/auth/callback") ||
      pathname.startsWith("/callback")
    ) {
      normalizedPath = pathname.startsWith("/callback") ? "/callback" : "/auth/callback";
      isAuthRoute = true;
    } else if (pathname.startsWith("/reset-password")) {
      normalizedPath = "/reset-password";
      isAuthRoute = true;
    }
  }

  return { protocol, host, pathname, search, hash, normalizedPath, isAuthRoute };
}
