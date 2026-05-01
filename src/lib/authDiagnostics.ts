/**
 * Lightweight in-memory + localStorage recorder for auth verification flow.
 * Used to debug the Android WebView signup/recovery email-link path.
 *
 * Stores REDACTED data only — never raw tokens.
 */

const STORAGE_KEY = "auth-diagnostics-log-v1";
const MAX_ENTRIES = 80;

export type AuthDiagEntry = {
  t: number; // timestamp ms
  tag: string;
  data?: Record<string, unknown>;
};

let memoryLog: AuthDiagEntry[] = [];

function loadFromStorage(): AuthDiagEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryLog.slice(-MAX_ENTRIES)));
  } catch {
    /* noop */
  }
}

// Hydrate from storage once on module load (covers cold-start).
memoryLog = loadFromStorage();

export function fingerprint(s: string | null | undefined): string {
  if (!s) return "none";
  return `len=${s.length} head=${s.slice(0, 4)}…`;
}

export function logAuthDiag(tag: string, data?: Record<string, unknown>): void {
  const entry: AuthDiagEntry = { t: Date.now(), tag, data };
  memoryLog.push(entry);
  if (memoryLog.length > MAX_ENTRIES) memoryLog = memoryLog.slice(-MAX_ENTRIES);
  persist();
  try {
    // Single-string log so Capacitor's WebView bridge writes it intact to
    // logcat (object args become "[object Object]" otherwise).
    let payload = "{}";
    try { payload = JSON.stringify(data ?? {}); } catch { payload = "[unserializable]"; }
    // eslint-disable-next-line no-console
    console.info(`[AuthVerify] ${tag} ${payload}`);
  } catch {
    /* noop */
  }
}

export function getAuthDiagEntries(): AuthDiagEntry[] {
  return [...memoryLog];
}

export function clearAuthDiag(): void {
  memoryLog = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function formatAuthDiag(): string {
  const lines: string[] = [];
  lines.push(`== AuthVerify diagnostics (${memoryLog.length} entries) ==`);
  lines.push(`ua=${navigator.userAgent}`);
  lines.push(`now=${new Date().toISOString()}`);
  lines.push(`url=${redactUrl(window.location.href)}`);
  lines.push("---");
  for (const e of memoryLog) {
    const ts = new Date(e.t).toISOString();
    let dataStr = "";
    if (e.data) {
      try {
        dataStr = " " + JSON.stringify(e.data);
      } catch {
        dataStr = " [unserializable]";
      }
    }
    lines.push(`${ts} ${e.tag}${dataStr}`);
  }
  return lines.join("\n");
}

export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const redactPart = (qs: string) =>
      qs
        .split("&")
        .map((p) => {
          const [k, v] = p.split("=");
          if (!v) return p;
          if (/token|code|secret|otp|hash|verify_url/i.test(k)) {
            return `${k}=[redacted:${v.length}]`;
          }
          return `${k}=${v}`;
        })
        .join("&");
    const search = u.search ? "?" + redactPart(u.search.slice(1)) : "";
    const hash = u.hash ? "#" + redactPart(u.hash.slice(1)) : "";
    return `${u.origin}${u.pathname}${search}${hash}`;
  } catch {
    return "[unparseable url]";
  }
}

export async function copyAuthDiagToClipboard(): Promise<boolean> {
  const text = formatAuthDiag();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
