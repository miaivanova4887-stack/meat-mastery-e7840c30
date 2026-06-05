// Per-platform runtime switch for native FCM.
//
// iOS: enabled. GoogleService-Info.plist is bundled, AppDelegate configures
// Firebase, APNs token is forwarded to FCM, and FCM registration tokens are
// surfaced to JS via a `fcm-token` window event.
//
// Android: disabled until android/app/google-services.json is added to the
// APK. Calling PushNotifications.register() without it crashes the WebView.

import { Capacitor } from "@capacitor/core";

export const NATIVE_FCM_ENABLED_IOS = true;
export const NATIVE_FCM_ENABLED_ANDROID = false;

export function isNativeFcmEnabled(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  if (p === "ios") return NATIVE_FCM_ENABLED_IOS;
  if (p === "android") return NATIVE_FCM_ENABLED_ANDROID;
  return false;
}

// Back-compat shim for callers that still import the old flag.
// Evaluates lazily so platform is read at call time, not import time.
export const NATIVE_FCM_ENABLED = false as boolean; // legacy; do not rely on
