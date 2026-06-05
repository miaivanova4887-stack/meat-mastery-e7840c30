// Shared push-consent decision audit. Used by:
// - usePushConsentFallback (App-level shell auto-prompt)
// - Onboarding completion flow
//
// Emits granular [PushDecision] log lines so logcat can prove exactly
// why the sheet was opened or suppressed on a given device.

import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getLocalPushConsent } from "@/lib/pushConsentLocal";
import { getNativePushPermission, savePushConsent } from "@/lib/pushFcm";

export type PushDecisionSource =
  | "shell"
  | "onboarding"
  | "profile-settings"
  | "requestNativePush";

export type SuppressReason =
  | "unsupported-platform"
  | "not-android" // legacy alias retained for back-compat in older logs
  | "already-shown-session"
  | "local-consent-set"
  | "profile-consent-set"
  | "prefs-opted-in"
  | "os-already-granted"
  | "anonymous-not-progressed";

export type PushDecision =
  | { show: true; reason: "eligible" }
  | { show: false; reason: SuppressReason };

const SESSION_FLAG = "push-prompt-shown";

function prefsIndicatePushOptIn(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return false;
  const p = prefs as Record<string, unknown>;
  return (
    p.streaks === true ||
    p.recipes === true ||
    p.fasting === true ||
    p.coaching === true
  );
}

interface AuditOptions {
  /** When true, an unauthenticated user without onboarding progress is suppressed. */
  requireOnboardingForAnonymous?: boolean;
  /** When true, ignore the once-per-session flag (e.g. explicit Profile open). */
  ignoreSessionFlag?: boolean;
}

export async function auditPushDecision(
  source: PushDecisionSource,
  options: AuditOptions = {},
): Promise<PushDecision> {
  const native = Capacitor.isNativePlatform();
  const platform = native ? Capacitor.getPlatform() : "web";

  // Allow both Android and iOS native; suppress web and any other platform.
  const isSupportedNative = native && (platform === "android" || platform === "ios");
  if (!isSupportedNative) {
    console.info(`[PushDecision] source=${source} branch=suppress reason=unsupported-platform native=${native} platform=${platform}`);
    return { show: false, reason: "unsupported-platform" };
  }

  // Session-once flag
  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(SESSION_FLAG) === "1"; } catch {}
  if (alreadyShown && !options.ignoreSessionFlag) {
    console.info(`[PushDecision] source=${source} branch=suppress reason=already-shown-session`);
    return { show: false, reason: "already-shown-session" };
  }

  // Local consent mirror
  const localConsent = getLocalPushConsent();
  let userPresent = false;
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    userPresent = !!userId;
  } catch (e) {
    console.warn(`[PushDecision] source=${source} branch=getUser-threw`, e);
  }
  console.info(`[PushDecision] source=${source} branch=start localConsent=${localConsent} userPresent=${userPresent}`);

  if (localConsent !== "unset") {
    try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch {}
    console.info(`[PushDecision] source=${source} branch=suppress reason=local-consent-set localConsent=${localConsent}`);
    return { show: false, reason: "local-consent-set" };
  }

  // Profile consent / prefs
  if (userId) {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("push_consent, notification_preferences")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data) {
        const profileConsent: string = data.push_consent ?? "unset";
        const prefsOptedIn = prefsIndicatePushOptIn(data.notification_preferences);
        console.info(`[PushDecision] source=${source} branch=profile profileConsent=${profileConsent} prefsOptedIn=${prefsOptedIn}`);
        if (profileConsent === "granted" || profileConsent === "denied") {
          try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch {}
          console.info(`[PushDecision] source=${source} branch=suppress reason=profile-consent-set profileConsent=${profileConsent}`);
          return { show: false, reason: "profile-consent-set" };
        }
        if (prefsOptedIn) {
          try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch {}
          console.info(`[PushDecision] source=${source} branch=suppress reason=prefs-opted-in`);
          return { show: false, reason: "prefs-opted-in" };
        }
      } else if (error) {
        console.warn(`[PushDecision] source=${source} branch=profile-error msg=${error.message}`);
      }
    } catch (e) {
      console.warn(`[PushDecision] source=${source} branch=profile-threw`, e);
    }
  }

  // OS-level permission
  let osPerm: string = "unsupported";
  try { osPerm = await getNativePushPermission(); } catch (e) {
    console.warn(`[PushDecision] source=${source} branch=os-threw`, e);
  }
  console.info(`[PushDecision] source=${source} branch=os osPermission=${osPerm}`);
  if (osPerm === "granted") {
    try { await savePushConsent("granted"); } catch (e) {
      console.warn(`[PushDecision] source=${source} branch=os-reconcile-failed`, e);
    }
    try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch {}
    console.info(`[PushDecision] source=${source} branch=suppress reason=os-already-granted`);
    return { show: false, reason: "os-already-granted" };
  }

  // Anonymous gate (only relevant for shell auto-prompt)
  if (options.requireOnboardingForAnonymous && !userPresent) {
    let progressed = false;
    try {
      progressed =
        localStorage.getItem("carnivore-onboarding-complete-v3") === "true";
    } catch {}
    if (!progressed) {
      console.info(`[PushDecision] source=${source} branch=suppress reason=anonymous-not-progressed`);
      return { show: false, reason: "anonymous-not-progressed" };
    }
  }

  try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch {}
  console.info(`[PushDecision] source=${source} branch=show-sheet reason=eligible`);
  return { show: true, reason: "eligible" };
}
