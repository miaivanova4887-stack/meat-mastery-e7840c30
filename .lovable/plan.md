# Why the notification permission is on but no phone is registered

## What I checked

- Your account (mia.ivanova.4887@gmail.com) exists and shows **notifications allowed**, recorded today at 19:57 UTC.
- The list of registered phones is **completely empty** — zero entries, for every user.
- The backend service that records a phone has **never been called even once** (no request history at all).

So the permission prompt worked, but the app never asked the notification service for a delivery address (a "device token") and never sent one to the backend.

## The cause

Android push delivery was switched on in the app only today at 19:48 UTC, together with the Firebase Android configuration file it needs. Any app version installed on your phone before that has push delivery compiled off: it still asks for the notification permission and saves your answer (which is exactly the record we see), but it deliberately skips the step that requests a delivery address. No address means nothing to send to.

The current source is version 1.1.6 (build 14) and includes the Firebase configuration. Your test device is almost certainly running 1.1.5 (build 13) or earlier.

## Plan

1. Confirm the version on the phone (Profile screen shows the build, or Android Settings → Apps → CarnivoreX → App details).
2. If it is below 1.1.6 (14): rebuild and install a fresh debug APK from the current source — line-by-line terminal commands provided, no code change needed.
3. Open the app, sign in, keep it open ~10 seconds.
4. I verify the phone now appears in the registered list and that the recording service was called.
5. I send a single real test notification to that phone and we confirm it arrives in the foreground and with the app closed.
6. Then check the scheduled reminders path (the 5-minute dispatcher) fires for your account.

If the phone already runs 1.1.6 (14) and still no entry appears, the next step is reading the phone's live log while reopening the app (`adb logcat` filtered on push/Firebase lines) to see whether Firebase reports a registration error instead.

## Technical notes

- `NATIVE_FCM_ENABLED_ANDROID` is now `true` in `src/lib/pushNativeConfig.ts`, and `android/app/google-services.json` (Firebase project carnivore-84bd2, package com.mi4labs.carnivorex) is in place — both landed at 19:48 UTC today.
- In `src/lib/pushFcm.ts`, `requestNativePush()` gates `PushNotifications.register()` behind `isNativeFcmEnabled()`, while `savePushConsent()` runs unconditionally — which is exactly why consent is `granted` with no `device_tokens` row.
- `device_tokens` and `push_subscriptions` are both empty; `register-device-token` has no invocation logs.
- No code changes are part of this plan; it is a rebuild-and-verify sequence.
