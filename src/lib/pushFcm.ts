// Native FCM push integration via @capacitor/push-notifications.
// Web push remains handled by src/lib/pushNotifications.ts (VAPID).

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { setLocalPushConsent } from "@/lib/pushConsentLocal";
import { NATIVE_FCM_ENABLED } from "@/lib/pushNativeConfig";

/** Race a native promise against a timeout so re-renders / resume
 *  cannot leave the JS bridge hanging. */
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

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
  // Also persist timezone + locale so the server-side reconciler can target
  // scheduled notifications at the right local time and language.
  let timezone = "UTC";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch {}
  let locale = "en";
  try {
    const stored = localStorage.getItem("carnivore-language");
    locale = (stored || navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
  } catch {}
  const patch = {
    push_consent: state,
    push_consent_at: new Date().toISOString(),
    timezone,
    locale,
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
  if (!NATIVE_FCM_ENABLED) {
    console.info("[PushDecision] bindListeners skipped reason=native-fcm-disabled");
    return;
  }
  if (listenersBound) {
    console.info("[Push] listeners already bound — skip");
    return;
  }
  listenersBound = true;
  console.info("[Push] binding push listeners (first time)");
  try {
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
  } catch (e) {
    console.error("[Push] addListener threw — swallowed", e);
  }
}

/**
 * Request native push permission and register the FCM token.
 * Idempotent: safe to call multiple times. Wrapped in try/catch so a
 * plugin failure can never propagate into a React render and crash.
 */
export async function requestNativePush(): Promise<PushConsentState> {
  if (!Capacitor.isNativePlatform()) {
    console.info("[PushDecision] source=requestNativePush branch=skip reason=not-native");
    return "unset";
  }

  const platform = Capacitor.getPlatform() as "android" | "ios";
  console.info(`[PushDecision] source=requestNativePush branch=start platform=${platform}`);

  try {
    let existing: NativePushPermission = "prompt";
    console.info("[PushDecision] source=requestNativePush branch=check-os-before-request");
    try { existing = await withTimeout(getNativePushPermission(), 4000, "checkPermissions"); } catch (e) {
      console.warn("[PushDecision] source=requestNativePush branch=check-os-threw", e);
    }
    if (existing === "granted") {
      console.info("[PushDecision] source=requestNativePush branch=os-already-granted reason=skip-prompt");
      if (NATIVE_FCM_ENABLED) {
        bindListenersOnce(platform);
        try {
          await withTimeout(PushNotifications.register(), 4000, "register");
        } catch (e) {
          console.warn("[PushDecision] source=requestNativePush branch=register-threw reason=os-already-granted", e);
        }
      } else {
        console.info("[PushDecision] source=requestNativePush branch=register-skipped reason=native-fcm-disabled");
      }
      try { await savePushConsent("granted"); } catch {}
      return "granted";
    }

    let perm: { receive: NativePushPermission } | undefined;
    try {
      console.info("[PushDecision] source=requestNativePush branch=requestPermissions-call");
      perm = await withTimeout(PushNotifications.requestPermissions(), 15000, "requestPermissions");
    } catch (e) {
      console.error("[PushDecision] source=requestNativePush branch=requestPermissions-threw — swallowed", e);
      try { await savePushConsent("denied"); } catch {}
      return "denied";
    }
    console.info(`[PushDecision] source=requestNativePush branch=requestPermissions-result receive=${perm?.receive}`);
    if (perm?.receive !== "granted") {
      try { await savePushConsent("denied"); } catch {}
      return "denied";
    }

    if (NATIVE_FCM_ENABLED) {
      console.info("[PushDecision] source=requestNativePush branch=register-call reason=fresh-grant");
      bindListenersOnce(platform);
      try {
        await withTimeout(PushNotifications.register(), 4000, "register");
      } catch (e) {
        console.warn("[PushDecision] source=requestNativePush branch=register-threw reason=fresh-grant", e);
      }
    } else {
      console.info("[PushDecision] source=requestNativePush branch=register-skipped reason=native-fcm-disabled");
    }
    try { await savePushConsent("granted"); } catch {}
    return "granted";
  } catch (e) {
    console.error("[PushDecision] source=requestNativePush branch=outer-threw — swallowed", e);
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
