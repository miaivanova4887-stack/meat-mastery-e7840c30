/**
 * Captures and persists the user's full name returned by Sign in with Apple
 * on the FIRST authorization. Apple never returns the name on later
 * sign-ins, so we cache it locally before any network write and retry
 * reconciliation indefinitely until profiles.display_name has been
 * confirmed updated. Required by App Store Guideline 5.1.1.
 */

import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "carnivore-apple-fullname-v1";
// Backoff used for retries — capped at 60s. Reconciliation keeps trying
// for the lifetime of the runtime once a cached name exists.
const RETRY_DELAYS_MS = [500, 1500, 4000, 10_000, 30_000, 60_000];

type AppleProfileShape = {
  givenName?: string | null;
  familyName?: string | null;
  // Some plugin builds wrap given/family inside `name`.
  name?: {
    firstName?: string | null;
    lastName?: string | null;
    givenName?: string | null;
    familyName?: string | null;
  } | null;
} | null | undefined;

export function extractAppleFullName(profile: AppleProfileShape): string | null {
  if (!profile) return null;
  const given =
    profile.givenName ||
    profile.name?.givenName ||
    profile.name?.firstName ||
    null;
  const family =
    profile.familyName ||
    profile.name?.familyName ||
    profile.name?.lastName ||
    null;
  const parts = [given, family].map((s) => (s ?? "").trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const joined = parts.join(" ").trim();
  return joined.length > 0 ? joined : null;
}

export function cacheAppleFullName(fullName: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, fullName);
  } catch {}
}

export function getCachedAppleFullName(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearCachedAppleFullName(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Returns true if the current display_name is empty or looks
 * auto-generated (email local-part or random slug), and therefore
 * safe to replace with the Apple-provided full name.
 */
function isReplaceable(current: string | null | undefined, email: string | null): boolean {
  const v = (current ?? "").trim();
  if (!v) return true;
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local && local.toLowerCase() === v.toLowerCase()) return true;
  }
  // Random slug like "zrhnd7k97h": no spaces, alphanum, 6–16 chars.
  if (/^[a-z0-9]{6,16}$/i.test(v) && !/\s/.test(v)) return true;
  return false;
}

// In-flight guard so we don't run multiple retry chains concurrently
// for the same user.
const inFlight = new Set<string>();

/**
 * Reconciles the cached Apple full name into profiles.display_name.
 * Caches the name locally first, retries with backoff until the
 * profile row exists AND the update succeeds (or the value is already
 * a real user-entered name we shouldn't overwrite). Only clears the
 * local cache after a confirmed write or a definitive "not replaceable"
 * decision.
 */
export async function reconcileAppleDisplayName(
  userId: string,
  fullName: string,
): Promise<void> {
  if (!userId || !fullName) return;
  // Always cache locally BEFORE any network attempt.
  cacheAppleFullName(fullName);

  if (inFlight.has(userId)) {
    console.info("[AppleName] reconcile already in-flight userId=", userId);
    return;
  }
  inFlight.add(userId);

  const attempt = async (i: number): Promise<void> => {
    try {
      // Mirror into auth user metadata (best-effort; ignored on failure).
      try {
        await supabase.auth.updateUser({
          data: { display_name: fullName, full_name: fullName },
        });
      } catch (e) {
        console.warn("[AppleName] updateUser metadata failed (continuing)", e);
      }

      const { data: userResp } = await supabase.auth.getUser();
      const email = userResp.user?.email ?? null;

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) {
        scheduleRetry(i, `profile-not-ready error=${error?.message ?? "none"}`);
        return;
      }

      if (!isReplaceable(data.display_name as string | null, email)) {
        console.info(
          "[AppleName] skip update — user already has a real name=",
          data.display_name,
        );
        clearCachedAppleFullName();
        inFlight.delete(userId);
        return;
      }

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ display_name: fullName })
        .eq("id", userId);

      if (updErr) {
        scheduleRetry(i, `update-failed ${updErr.message}`);
        return;
      }

      // Confirm the write before clearing the cache.
      const { data: confirm } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      if ((confirm?.display_name ?? "").trim() === fullName.trim()) {
        console.info("[AppleName] reconciled display_name=", fullName);
        clearCachedAppleFullName();
        try {
          window.dispatchEvent(new Event("profile-update"));
        } catch {}
        inFlight.delete(userId);
        return;
      }
      scheduleRetry(i, "post-write confirmation mismatch");
    } catch (e) {
      scheduleRetry(i, `threw ${String(e)}`);
    }
  };

  const scheduleRetry = (i: number, reason: string) => {
    const delay = RETRY_DELAYS_MS[Math.min(i, RETRY_DELAYS_MS.length - 1)];
    console.info("[AppleName] retry in", delay, "ms reason=", reason);
    setTimeout(() => { void attempt(i + 1); }, delay);
  };

  void attempt(0);
}

/**
 * Called on session bootstrap: if we have a cached Apple name (because
 * the previous reconcile attempt didn't confirm yet), kick off another
 * reconcile pass.
 */
export function reconcileCachedAppleName(userId: string): void {
  const cached = getCachedAppleFullName();
  if (!cached) return;
  void reconcileAppleDisplayName(userId, cached);
}
