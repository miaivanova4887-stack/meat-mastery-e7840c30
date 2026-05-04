// Native FCM push integration via @capacitor/push-notifications.
// Web push remains handled by src/lib/pushNotifications.ts (VAPID).

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { setLocalPushConsent } from "@/lib/pushConsentLocal";

export type PushConsentState = "unset" | "granted" | "denied";
export type NativePushPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "prompt-with-rationale"
  | "unsupported";

// Module-scoped guard so duplicate calls don't stack listeners or
// re-register tokens (the path that has been crashing on resume).
let listenersBound = false;

/**
 * Persist consent + (optional) preferences.
 * Always writes a local mirror so anonymous users' choices survive until
 * sign-in, when AuthContext reconciles the value into profiles.push_consent.
 */
export async function savePushConsent(
  state: PushConsentState,
  preferences?: Record<string, boolean>,
): Promise<void> {
  // Local mirror — works even when no user is signed in.
  setLocalPushConsent(state);
  const { data: { user } } = await supabase.auth.getUser();
  console.info("[Push] savePushConsent local=", state, "userPresent=", !!user);
  if (!user) return;
  const patch = {
    push_consent: state,
    push_consent_at: new Date().toISOString(),
    ...(preferences ? { notification_preferences: preferences } : {}),
  };
  await supabase.from("profiles").update(patch).eq("id", user.id);
}

/**
 * Read the OS-level POST_NOTIFICATIONS state without prompting.
 * Safe to call from React render paths — never throws.
 */
export async function getNativePushPermission(): Promise<NativePushPermission> {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  try {
    const res = await PushNotifications.checkPermissions();
    console.info("[Push] checkPermissions receive=", res.receive);
    return (res.receive as NativePushPermission) ?? "prompt";
  } catch (e) {
    console.warn("[Push] checkPermissions threw", e);
    return "unsupported";
  }
}

function bindListenersOnce(platform: "android" | "ios") {
  if (listenersBound) {
    console.info("[Push] listeners already bound — skip");
    return;
  }
  listenersBound = true;
  console.info("[Push] binding push listeners (first time)");
  PushNotifications.addListener("registration", async (t) => {
    try {
      console.info("[Push] FCM token registered len=", t.value?.length ?? 0);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke("register-device-token", {
        body: { token: t.value, platform },
      });
    } catch (e) {
      console.error("[Push] token register failed", e);
    }
  });
  PushNotifications.addListener("registrationError", (err) => {
    console.error("[Push] FCM registration error", err);
  });
}

/**
 * Request native push permission and register the FCM token.
 * Idempotent: safe to call multiple times. Wrapped in try/catch so a
 * plugin failure can never propagate into a React render and crash.
 */
export async function requestNativePush(): Promise<PushConsentState> {
  if (!Capacitor.isNativePlatform()) {
    console.info("[PushDecision] requestNativePush skipped — not native");
    return "unset";
  }

  const platform = Capacitor.getPlatform() as "android" | "ios";
  console.info("[PushDecision] requestNativePush start platform=", platform);

  try {
    let existing: NativePushPermission = "prompt";
    try { existing = await getNativePushPermission(); } catch (e) {
      console.warn("[PushDecision] checkPermissions threw", e);
    }
    if (existing === "granted") {
      console.info("[PushDecision] OS already granted — skipping requestPermissions");
      bindListenersOnce(platform);
      try {
        console.info("[PushDecision] register() call (granted-skip)");
        await PushNotifications.register();
      } catch (e) {
        console.warn("[PushDecision] register() after granted-skip failed — swallowed", e);
      }
      try { await savePushConsent("granted"); } catch {}
      return "granted";
    }

    let perm;
    try {
      console.info("[PushDecision] requestPermissions() call");
      perm = await PushNotifications.requestPermissions();
    } catch (e) {
      console.error("[PushDecision] requestPermissions threw — swallowed", e);
      try { await savePushConsent("denied"); } catch {}
      return "denied";
    }
    console.info("[PushDecision] requestPermissions result receive=", perm.receive);
    if (perm.receive !== "granted") {
      try { await savePushConsent("denied"); } catch {}
      return "denied";
    }

    bindListenersOnce(platform);
    try {
      console.info("[PushDecision] register() call (fresh-grant)");
      await PushNotifications.register();
    } catch (e) {
      console.warn("[PushDecision] register() after fresh-grant failed — swallowed", e);
    }
    try { await savePushConsent("granted"); } catch {}
    return "granted";
  } catch (e) {
    console.error("[PushDecision] requestNativePush outer threw — swallowed", e);
    try { await savePushConsent("denied"); } catch {}
    return "denied";
  }
}

/** Fire an event that may trigger push campaigns. Non-blocking. */
export async function triggerPushEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke("push-event-trigger", {
      body: { event_name: eventName, event_data: eventData },
    });
  } catch (e) {
    // Never let messaging affect app flow
    console.warn("triggerPushEvent failed", e);
  }
}
