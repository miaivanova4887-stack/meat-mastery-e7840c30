# No phone token yet — evidence-first check

## What the backend shows right now

- Your account (`mia.ivanova.4887@gmail.com`) still shows notifications allowed, saved at **20:09 UTC** — the same timestamp as before the rebuild, so no new "allow" was recorded after installing.
- The registered-devices table is still **completely empty** (0 rows).
- Nothing has reached the device-registration service.

Conclusion: the app on the phone has not yet asked Firebase for a token. The most likely reasons, in order: the installed build is not the new one (15 / 1.1.7), or the app is not signed in when the automatic registration runs, or Firebase registration is failing silently on the device.

## Step 1 — Confirm which build is on the phone

```bash
cd ~/Desktop/carnivorex-android
adb devices
adb shell dumpsys package com.mi4labs.carnivorex | grep -E "versionName|versionCode"
```

Expected: `versionCode=15`, `versionName=1.1.7`. If it shows 14 / 1.1.6, the old app is still installed — uninstall and reinstall:

```bash
adb uninstall com.mi4labs.carnivorex
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Step 2 — Capture the app's own log while it starts

Terminal 1:

```bash
adb logcat -c
adb logcat | grep -iE "Push|PushDecision|FCM|Firebase|registration|Capacitor"
```

Terminal 2 (or on the phone): force-stop the app, open it, sign in, wait 20 seconds.

```bash
adb shell am force-stop com.mi4labs.carnivorex
adb shell monkey -p com.mi4labs.carnivorex -c android.intent.category.LAUNCHER 1
```

Paste everything Terminal 1 prints.

## Step 3 — What each log outcome means

- `[Push] automatic registration check ... permission=granted` then `[Push] device token persisted platform=android` → done, I verify the token and send a test notification.
- `... reason=no-session` → app is not signed in at that moment; sign in and reopen.
- `registrationError` → Firebase rejected the app; the config file or package/signing mismatch is the cause and I fix that next.
- No `[Push]` lines at all → the new build is not actually running; back to Step 1.

## Step 4 — After a token appears

I query the registered devices table, then send one test notification to that phone and confirm it shows both with the app open and closed, followed by a scheduled reminder check.

## Technical notes

- Build in the working tree: versionCode 15, versionName 1.1.7 (`android/app/build.gradle`).
- Registration path: `src/lib/pushFcm.ts` → `retryNativeRegistrationIfGranted()` runs at module load and on `SIGNED_IN` / `TOKEN_REFRESHED` / `INITIAL_SESSION`, then `PushNotifications.register()` → `register-device-token` edge function → `device_tokens`.
- `android/app/google-services.json` is present for `com.mi4labs.carnivorex` (Firebase project `carnivore-84bd2`); Firebase sending credentials were already validated server-side.
- No code changes are proposed until the logcat output identifies the failing stage.
