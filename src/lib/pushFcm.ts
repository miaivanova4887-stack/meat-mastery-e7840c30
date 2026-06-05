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

// ---------------------------------------------------------------------------
// Push-tap deep linking
// ---------------------------------------------------------------------------
// Resolves an in-app path from a notification's data payload. The dispatcher
// sets `path` explicitly; we also support a `target`+`session_id` fallback
// and a legacy `url` field used by older notifications.
const PENDING_NAV_KEY = "push-nav-pending";
let pendingPushNav: string | null = null;

function safeAbsPath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  if (!p.startsWith("/")) return null;
  return p;
}

function resolvePushNavPath(data: Record<string, unknown> | undefined | null): string | null {
  if (!data) {
    console.info("[PushTap] resolve branch=null reason=no-data");
    return null;
  }
  const hasPath = typeof data.path === "string";
  const hasTarget = typeof data.target === "string";
  const hasSessionId = typeof data.session_id === "string";
  console.info("[PushTap] resolve inputs", {
    hasPath, hasTarget, hasSessionId,
    target: data.target, type: data.type,
  });
  const direct = safeAbsPath(data.path);
  if (direct) {
    console.info("[PushTap] resolve branch=path path=", direct);
    return direct;
  }
  if (data.target === "coaching_upcoming_session") {
    const base = "/profile?tab=settings&section=coaching";
    const sid = typeof data.session_id === "string" ? data.session_id : "";
    const out = sid ? `${base}&sessionId=${encodeURIComponent(sid)}` : base;
    console.info("[PushTap] resolve branch=target path=", out);
    return out;
  }
  const url = safeAbsPath(data.url);
  if (url) {
    console.info("[PushTap] resolve branch=url path=", url);
    return url;
  }
  console.info("[PushTap] resolve branch=null reason=no-match");
  return null;
}

function queuePushNav(path: string) {
  pendingPushNav = path;
  let stored = false;
  try { sessionStorage.setItem(PENDING_NAV_KEY, path); stored = true; } catch {/* ignore */}
  let dispatched = false;
  try {
    window.dispatchEvent(new CustomEvent("push-nav", { detail: { path } }));
    dispatched = true;
  } catch {/* ignore */}
  console.info("[PushTap] queue", { path, stored, dispatched });
}

export function consumePendingPushNav(): string | null {
  const v = pendingPushNav;
  pendingPushNav = null;
  return v;
}

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

let actionListenerBound = false;

function bindActionListenerOnce() {
  if (actionListenerBound) return;
  if (!Capacitor.isNativePlatform()) return;
  actionListenerBound = true;
  try {
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = (action?.notification?.data ?? {}) as Record<string, unknown>;
      const path = resolvePushNavPath(data);
      console.info("[Push] actionPerformed", { hasData: !!data, path, type: data?.type });
      if (path) queuePushNav(path);
    });
    PushNotifications.addListener("pushNotificationReceived", (n) => {
      // Foreground receive — do not auto-navigate. iOS shows the banner;
      // tap will route via actionPerformed.
      const data = (n?.data ?? {}) as Record<string, unknown>;
      console.info("[Push] notificationReceived (foreground)", { type: data?.type });
    });
    console.info("[Push] action listeners bound");
  } catch (e) {
    console.warn("[Push] action listener bind failed", e);
  }
}

function bindListenersOnce(platform: "android" | "ios") {
  if (!isNativeFcmEnabled()) {
    console.info("[PushDecision] bindListeners skipped reason=native-fcm-disabled");
    return;
  }
  // iOS sources tokens via window event (FCM), Android via PushNotifications.registration.
  if (platform === "ios") bindFcmTokenListenerOnce();

  // Action listener should bind regardless of token-source path.
  bindActionListenerOnce();

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

  // Bind plugin listeners up front so any registration / registrationError
  // event that fires after register() is observed (and logged) regardless
  // of which branch we take below.
  if (isNativeFcmEnabled()) {
    bindListenersOnce(platform);
    bindAppStateListenerOnce(platform);
  }

  let existing: NativePushPermission = "prompt";
  try {
    existing = await withTimeout(getNativePushPermission(), 4000, "checkPermissions");
  } catch (e) {
    console.warn("[Push] checkPermissions threw", e);
  }
  console.info(`[Push] requestPermissions existing=${existing} platform=${platform}`);

  let finalReceive: NativePushPermission = existing;

  if (existing !== "granted") {
    try {
      console.info(`[Push] requestPermissions called platform=${platform}`);
      const perm = await withTimeout(
        PushNotifications.requestPermissions(),
        15000,
        "requestPermissions",
      );
      finalReceive = (perm?.receive as NativePushPermission) ?? "denied";
      console.info(`[Push] requestPermissions result receive=${finalReceive}`);
    } catch (e) {
      console.error("[Push] requestPermissions threw — treating as denied", e);
      finalReceive = "denied";
    }
  } else {
    console.info("[Push] requestPermissions skipped reason=os-already-granted");
  }

  // iOS-specific behavior: call register() regardless of permission verdict.
  // This invokes UIApplication.registerForRemoteNotifications, which is what
  // makes iOS record the app under Settings → Notifications and is required
  // for APNs/FCM token issuance once permission is granted (now or later).
  // On Android, register() is only meaningful after grant.
  const shouldRegister = isNativeFcmEnabled() &&
    (platform === "ios" || finalReceive === "granted");

  if (shouldRegister) {
    try {
      console.info(`[Push] register called platform=${platform} receive=${finalReceive}`);
      await withTimeout(PushNotifications.register(), 4000, "register");
      console.info(`[Push] register() returned platform=${platform} — registration/registrationError event will follow`);
    } catch (e) {
      console.warn(`[Push] register threw platform=${platform}`, e);
    }
  } else {
    console.info(`[Push] register skipped platform=${platform} fcmEnabled=${isNativeFcmEnabled()} receive=${finalReceive}`);
  }

  const consent: PushConsentState = finalReceive === "granted" ? "granted" : "denied";
  try { await savePushConsent(consent); } catch (e) {
    console.warn("[Push] savePushConsent failed", e);
  }
  return consent;
}

// Bind the FCM window event as early as possible on iOS so a token that
// arrives before requestNativePush() ran (warm starts) is still captured.
if (typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && NATIVE_FCM_ENABLED_IOS) {
  bindFcmTokenListenerOnce();
}

// Bind the push-tap action listener at module load on any native platform so
// cold-start taps (where the OS launches the app from a notification) are
// captured before React Router mounts. The handler queues the path in a
// module-level variable + sessionStorage; usePushNavigation drains both.
if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
  bindActionListenerOnce();
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
