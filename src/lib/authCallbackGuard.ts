/**
 * Tiny module-level flag shared between AuthCallback and useDeepLinks
 * so the resume handler does not race the callback's setSession() call.
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

/**
 * normalizeAuthCallbackUrl
 *
 * Accepts ALL native callback shapes and returns a normalized result:
 *   - carnivorex://callback#...           → /callback
 *   - carnivorex:///callback#...          → /callback
 *   - carnivorex://auth/callback#...      → /auth/callback
 *   - https://app.carnivorex.app/auth/callback... → /auth/callback
 *
 * For custom schemes URL parsing is inconsistent across runtimes, so we
 * use a raw-string fallback.
 */
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
    // ignore — handled by raw-string fallback below
  }

  // Raw-string fallbacks for shapes that some URL parsers mangle.
  // carnivorex:///callback#...  → host="" pathname="/callback"
  // carnivorex://callback#...   → host="callback" pathname=""  (or "/")
  // carnivorex://auth/callback  → host="auth" pathname="/callback"
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
    // https / http App Link path
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
