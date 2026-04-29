// Local mirror of push consent state, usable before a user signs in.
// Mirrors the values stored in profiles.push_consent so anonymous users
// can record/skip the opt-in sheet and have the choice reconciled into
// their profile after sign-in/sign-up.

export type LocalPushConsent = "unset" | "granted" | "denied";

const KEY = "carnivore-push-consent-v1";
const KEY_AT = "carnivore-push-consent-at-v1";

export function getLocalPushConsent(): LocalPushConsent {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "granted" || v === "denied") return v;
    return "unset";
  } catch {
    return "unset";
  }
}

export function getLocalPushConsentAt(): string | null {
  try {
    return localStorage.getItem(KEY_AT);
  } catch {
    return null;
  }
}

export function setLocalPushConsent(state: LocalPushConsent): void {
  try {
    localStorage.setItem(KEY, state);
    localStorage.setItem(KEY_AT, new Date().toISOString());
  } catch {
    // ignore storage failures
  }
}

export function clearLocalPushConsent(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_AT);
  } catch {
    // ignore
  }
}
