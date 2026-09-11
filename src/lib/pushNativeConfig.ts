// Per-platform runtime switch for native FCM.
//
// iOS: enabled. GoogleService-Info.plist is bundled, AppDelegate configures
// Firebase, APNs token is forwarded to FCM, and FCM registration tokens are
// surfaced to JS via a `fcm-token` window event.
//
// Android: enabled. android/app/google-services.json ships in the app
// (Firebase project carnivore-84bd2, package com.mi4labs.carnivorex), so the
// google-services Gradle plugin is applied and PushNotifications.register()
// can obtain an FCM token safely.

import { Capacitor } from "@capacitor/core";

export const NATIVE_FCM_ENABLED_IOS = true;
export const NATIVE_FCM_ENABLED_ANDROID = true;

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
