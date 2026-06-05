// Native FCM push integration via @capacitor/push-notifications + Firebase iOS.
// Web push remains handled by src/lib/pushNotifications.ts (VAPID).
//
// iOS path: AppDelegate.swift configures Firebase, sets Messaging.apnsToken
// from the APNs token, and dispatches a `fcm-token` window CustomEvent with
// the FCM registration token. We listen to that here and persist the token
// in device_tokens (platform='ios') via the register-device-token edge fn.
//
// Android path: native FCM is currently disabled (no google-services.json
// shipping yet); register() is a no-op until that lands.

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { App as CapApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { setLocalPushConsent } from "@/lib/pushConsentLocal";
import { isNativeFcmEnabled, NATIVE_FCM_ENABLED_IOS } from "@/lib/pushNativeConfig";
import { normalizeLocale } from "@/lib/locale";

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

let listenersBound = false;
let fcmTokenListenerBound = false;
let appStateListenerBound = false;

export async function savePushConsent(
  state: PushConsentState,
  preferences?: Record<string, boolean>,
): Promise<void> {
  setLocalPushConsent(state);
  const { data: { user } } = await supabase.auth.getUser();
  console.info("[Push] savePushConsent local=", state, "userPresent=", !!user);
  if (!user) return;
  let timezone = "UTC";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch {}
  let locale: "en" | "fr" = "en";
  try {
    const stored = localStorage.getItem("carnivore-language");
    locale = normalizeLocale(stored || navigator.language);
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

async function registerDeviceTokenWithBackend(token: string, platform: "android" | "ios") {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.info("[Push] skipping token register — no session");
      return;
    }
    await supabase.functions.invoke("register-device-token", {
      body: { token, platform },
    });
    console.info(`[Push] device token persisted platform=${platform} len=${token.length}`);
  } catch (e) {
    console.error("[Push] token register failed", e);
  }
}

// iOS: FCM token arrives via window event dispatched from AppDelegate.
function bindFcmTokenListenerOnce() {
  if (fcmTokenListenerBound) return;
  fcmTokenListenerBound = true;
  if (typeof window === "undefined") return;
  window.addEventListener("fcm-token", (ev: Event) => {
    const detail = (ev as CustomEvent).detail as { token?: string; platform?: string } | undefined;
    if (!detail?.token) return;
    const platform = (detail.platform === "android" ? "android" : "ios") as "ios" | "android";
    console.info(`[Push] window:fcm-token received platform=${platform} len=${detail.token.length}`);
    void registerDeviceTokenWithBackend(detail.token, platform);
  });
  console.info("[Push] window:fcm-token listener bound");
}

function bindListenersOnce(platform: "android" | "ios") {
  if (!isNativeFcmEnabled()) {
    console.info("[PushDecision] bindListeners skipped reason=native-fcm-disabled");
    return;
  }
  // iOS sources tokens via window event (FCM), Android via PushNotifications.registration.
  if (platform === "ios") bindFcmTokenListenerOnce();

  if (listenersBound) {
    console.info("[Push] plugin listeners already bound — skip");
    return;
  }
  listenersBound = true;
  console.info("[Push] binding push plugin listeners (first time)");
  try {
    PushNotifications.addListener("registration", async (t) => {
      // On iOS the value is the APNs hex token (not what the backend wants);
      // FCM token comes through the window 'fcm-token' event instead.
      console.info(`[Push] registration success platform=${platform} valueLen=${t.value?.length ?? 0}`);
      if (platform === "android") {
        await registerDeviceTokenWithBackend(t.value, "android");
      } else {
        console.info("[Push] iOS APNs-token registration event len=", t.value?.length ?? 0);
      }
    });
    PushNotifications.addListener("registrationError", (err) => {
      console.error(`[Push] registrationError platform=${platform}`, err);
    });
  } catch (e) {
    console.error("[Push] addListener threw — swallowed", e);
  }
}

function bindAppStateListenerOnce(platform: "android" | "ios") {
  if (appStateListenerBound) return;
  if (platform !== "ios") return; // only iOS rotates tokens & benefits from re-register
  appStateListenerBound = true;
  try {
    CapApp.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive) return;
      try {
        const perm = await getNativePushPermission();
        if (perm !== "granted") return;
        await withTimeout(PushNotifications.register(), 4000, "register(resume)");
      } catch (e) {
        console.warn("[Push] resume re-register failed — swallowed", e);
      }
    });
    console.info("[Push] appStateChange listener bound (iOS)");
  } catch (e) {
    console.warn("[Push] appStateChange bind failed", e);
  }
}

export async function requestNativePush(): Promise<PushConsentState> {
  if (!Capacitor.isNativePlatform()) {
    console.info("[PushDecision] source=requestNativePush branch=skip reason=not-native");
    return "unset";
  }

  const platform = Capacitor.getPlatform() as "android" | "ios";
  console.info(`[PushDecision] source=requestNativePush branch=start platform=${platform}`);

  try {
    let existing: NativePushPermission = "prompt";
    try { existing = await withTimeout(getNativePushPermission(), 4000, "checkPermissions"); } catch (e) {
      console.warn("[PushDecision] check-os-threw", e);
    }
    if (existing === "granted") {
      console.info("[PushDecision] os-already-granted");
      if (isNativeFcmEnabled()) {
        bindListenersOnce(platform);
        bindAppStateListenerOnce(platform);
        try {
          await withTimeout(PushNotifications.register(), 4000, "register");
        } catch (e) {
          console.warn("[PushDecision] register-threw os-already-granted", e);
        }
      } else {
        console.info("[PushDecision] register-skipped native-fcm-disabled");
      }
      try { await savePushConsent("granted"); } catch {}
      return "granted";
    }

    let perm: { receive: NativePushPermission } | undefined;
    try {
      perm = await withTimeout(PushNotifications.requestPermissions(), 15000, "requestPermissions");
    } catch (e) {
      console.error("[PushDecision] requestPermissions-threw — swallowed", e);
      try { await savePushConsent("denied"); } catch {}
      return "denied";
    }
    console.info(`[PushDecision] requestPermissions-result receive=${perm?.receive}`);
    if (perm?.receive !== "granted") {
      try { await savePushConsent("denied"); } catch {}
      return "denied";
    }

    if (isNativeFcmEnabled()) {
      bindListenersOnce(platform);
      bindAppStateListenerOnce(platform);
      try {
        await withTimeout(PushNotifications.register(), 4000, "register");
      } catch (e) {
        console.warn("[PushDecision] register-threw fresh-grant", e);
      }
    } else {
      console.info("[PushDecision] register-skipped native-fcm-disabled");
    }
    try { await savePushConsent("granted"); } catch {}
    return "granted";
  } catch (e) {
    console.error("[PushDecision] outer-threw — swallowed", e);
    try { await savePushConsent("denied"); } catch {}
    return "denied";
  }
}

// Bind the FCM window event as early as possible on iOS so a token that
// arrives before requestNativePush() ran (warm starts) is still captured.
if (typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && NATIVE_FCM_ENABLED_IOS) {
  bindFcmTokenListenerOnce();
}

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
    console.warn("triggerPushEvent failed", e);
  }
}
