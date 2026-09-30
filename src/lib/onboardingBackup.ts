import { supabase } from "@/integrations/supabase/client";

/**
 * Deferred cloud backup of the onboarding answers that normally live only
 * in localStorage.
 *
 * Design notes:
 * - Local storage stays the source of truth for the running app, so
 *   onboarding never waits on the network.
 * - The backup is written into the signed-in user's own profile row
 *   (`profiles.user_attributes.onboarding_backup`), which is protected by
 *   row-level security, so nothing is uploaded for anonymous devices.
 * - Writes are deferred (idle/timeout) and retried with a small backoff.
 * - Restore only fills in *missing* local values; it never overwrites
 *   fresher answers on the device, and it never restores the
 *   "onboarding complete" flag (a deliberate local reset must stick).
 */

const BACKUP_FIELD = "onboarding_backup";
const BACKUP_AT_FIELD = "onboarding_backup_at";
export const ONBOARDING_UPDATED_AT_KEY = "carnivore-onboarding-updated-at";

/** Local keys that make up an onboarding snapshot. */
const BACKED_UP_KEYS = [
  "carnivore-onboarding-answers",
  "carnivore-onboarding-body",
  "carnivore-health-targets",
  "carnivore-cuisines",
  "carnivore-custom-cuisines",
  "carnivore-meals-per-day",
  ONBOARDING_UPDATED_AT_KEY,
] as const;

const COMPLETE_KEY = "carnivore-onboarding-complete-v3";
const RETRY_DELAYS_MS = [2000, 8000, 30000];

type Snapshot = Record<string, string>;

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Stamp the device snapshot as changed right now. */
export function markOnboardingUpdated() {
  writeLocal(ONBOARDING_UPDATED_AT_KEY, new Date().toISOString());
}

function buildSnapshot(): Snapshot | null {
  const snapshot: Snapshot = {};
  for (const key of BACKED_UP_KEYS) {
    const value = readLocal(key);
    if (value !== null) snapshot[key] = value;
  }
  // Nothing worth backing up unless real answers exist.
  if (!snapshot["carnivore-onboarding-answers"]) return null;
  snapshot.complete = readLocal(COMPLETE_KEY) === "true" ? "true" : "false";
  return snapshot;
}

function runDeferred(fn: () => void) {
  const idle = (globalThis as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout?: number }) => number)
    | undefined;
  if (idle) idle(() => fn(), { timeout: 5000 });
  else setTimeout(fn, 1200);
}

let inFlightForUser: string | null = null;

async function loadAttributes(userId: string): Promise<Record<string, any> | null> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("user_attributes")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const attrs = data.user_attributes;
  return attrs && typeof attrs === "object" ? { ...attrs } : {};
}

async function pushSnapshot(userId: string, attempt = 0): Promise<void> {
  const snapshot = buildSnapshot();
  if (!snapshot) {
    console.info("[OnboardingBackup] nothing to back up yet");
    return;
  }
  try {
    const attrs = await loadAttributes(userId);
    if (!attrs) {
      if (attempt < RETRY_DELAYS_MS.length) {
        setTimeout(() => { void pushSnapshot(userId, attempt + 1); }, RETRY_DELAYS_MS[attempt]);
      }
      return;
    }

    const localStamp = snapshot[ONBOARDING_UPDATED_AT_KEY];
    const remote = attrs[BACKUP_FIELD] as Snapshot | undefined;
    const remoteStamp = remote?.[ONBOARDING_UPDATED_AT_KEY];
    // Never overwrite a newer cloud copy with an older device copy.
    if (remote && localStamp && remoteStamp && remoteStamp > localStamp) {
      console.info("[OnboardingBackup] cloud copy is newer, skipping upload");
      return;
    }
    if (remote && JSON.stringify(remote) === JSON.stringify(snapshot)) return;

    attrs[BACKUP_FIELD] = snapshot;
    attrs[BACKUP_AT_FIELD] = new Date().toISOString();

    const { error } = await (supabase as any)
      .from("profiles")
      .update({ user_attributes: attrs })
      .eq("id", userId);
    if (error) {
      if (attempt < RETRY_DELAYS_MS.length) {
        setTimeout(() => { void pushSnapshot(userId, attempt + 1); }, RETRY_DELAYS_MS[attempt]);
      }
      console.warn("[OnboardingBackup] upload failed", error.message);
      return;
    }
    console.info("[OnboardingBackup] uploaded snapshot keys=", Object.keys(snapshot).length);
  } catch (e) {
    if (attempt < RETRY_DELAYS_MS.length) {
      setTimeout(() => { void pushSnapshot(userId, attempt + 1); }, RETRY_DELAYS_MS[attempt]);
    }
    console.warn("[OnboardingBackup] upload threw", e);
  }
}

/** Fill any missing local onboarding values from the cloud copy. */
async function restoreMissing(userId: string): Promise<void> {
  try {
    const attrs = await loadAttributes(userId);
    const remote = attrs?.[BACKUP_FIELD] as Snapshot | undefined;
    if (!remote || !remote["carnivore-onboarding-answers"]) return;
    let restored = 0;
    for (const key of BACKED_UP_KEYS) {
      const value = remote[key];
      if (value === undefined) continue;
      if (readLocal(key) !== null) continue;
      writeLocal(key, value);
      restored += 1;
    }
    if (restored > 0) {
      console.info("[OnboardingBackup] restored missing local keys=", restored);
      try {
        window.dispatchEvent(new Event("profile-update"));
      } catch {}
    }
  } catch (e) {
    console.warn("[OnboardingBackup] restore threw", e);
  }
}

/**
 * Called once per signed-in user: restores anything missing locally, then
 * backs the current device snapshot up. Both steps run off the critical path.
 */
export function syncOnboardingBackup(userId: string) {
  if (inFlightForUser === userId) return;
  inFlightForUser = userId;
  runDeferred(() => {
    void (async () => {
      await restoreMissing(userId);
      await pushSnapshot(userId);
      inFlightForUser = null;
    })();
  });
}

/** Back up right after onboarding finishes, if a session already exists. */
export async function backupOnboardingNow() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    markOnboardingUpdated();
    await pushSnapshot(user.id);
  } catch {}
}
