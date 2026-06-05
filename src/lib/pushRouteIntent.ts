// Durable record of the most recent push-tap navigation intent.
// Used by usePushNavigation (to navigate), Profile (to suppress auth redirect
// while a push intent is in flight) and CoachingSessionsList (to confirm the
// pending session id reached the right consumer).

const KEY = "push-route-intent";
const MAX_AGE_MS = 90_000;

export interface PushRouteIntent {
  path: string;
  createdAt: number;
  consumedAt?: number;
  verifiedAt?: number;
}

function read(): PushRouteIntent | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PushRouteIntent;
    if (!parsed?.path || typeof parsed.createdAt !== "number") return null;
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(intent: PushRouteIntent) {
  try { localStorage.setItem(KEY, JSON.stringify(intent)); } catch {/* ignore */}
  try { sessionStorage.setItem(KEY, JSON.stringify(intent)); } catch {/* ignore */}
}

export function recordPushRouteIntent(path: string) {
  const intent: PushRouteIntent = { path, createdAt: Date.now() };
  write(intent);
  console.info("[PushIntent] recorded", intent);
}

export function getActivePushRouteIntent(): PushRouteIntent | null {
  return read();
}

export function markPushRouteIntentConsumed() {
  const cur = read();
  if (!cur) return;
  cur.consumedAt = Date.now();
  write(cur);
  console.info("[PushIntent] consumed", cur);
}

export function markPushRouteIntentVerified() {
  const cur = read();
  if (!cur) return;
  cur.verifiedAt = Date.now();
  write(cur);
  try { localStorage.removeItem(KEY); } catch {/* ignore */}
  try { sessionStorage.removeItem(KEY); } catch {/* ignore */}
  console.info("[PushIntent] verified+cleared", cur);
}
