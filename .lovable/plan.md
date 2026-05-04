I agree that a normal Publish/update will not fix these two runtime issues by itself. The APK is fresh, so the remaining failures are in native/runtime code paths. A local `git pull` can help only if the APK was built from an older local checkout; since your BuildInfo fingerprint is fresh, the next fix needs code changes, then a new APK build/install.

Concrete findings from the current code:

1. Portrait lock is still tied to a tablet heuristic and target SDK 36
- Current files responsible:
  - `android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java`
  - `android/app/src/main/AndroidManifest.xml`
  - `android/variables.gradle`
- Current runtime path:
  - Manifest declares `android:screenOrientation="portrait"`.
  - `MainActivity.applyPhonePortraitLock()` uses `smallestScreenWidthDp >= 600` to treat a device as tablet.
  - If the phone/foldable reports `sw >= 600`, it applies `SCREEN_ORIENTATION_FULL_USER`, so rotation is explicitly allowed.
  - `targetSdkVersion = 36`; Android 16/API 36 behavior can ignore app orientation restrictions on large-screen classifications. This matters especially for foldables/tablet-like phone modes.

2. Notification prompt/crash has at least two still-open paths
- Current files responsible:
  - `src/components/NotificationConsentSheet.tsx`
  - `src/lib/pushFcm.ts`
  - `src/lib/pushDecision.ts`
  - `src/pages/Profile.tsx`
- Current runtime paths:
  - `Profile.tsx` opens `NotificationConsentSheet` directly on tap without calling `auditPushDecision()` first.
  - `NotificationConsentSheet.handleEnable()` calls `requestNativePush()` when OS permission is not `granted`; this can still call native `PushNotifications.requestPermissions()` and then `PushNotifications.register()`.
  - `pushFcm.ts` calls `PushNotifications.register()` even when OS permission is already granted. If native Firebase config is missing or invalid, Capacitor registration can crash/error. The repository currently has no `android/app/google-services.json`, and Capacitor PushNotifications requires that file for native FCM registration.
  - `pushDecision.ts` suppresses the prompt on default `notification_preferences` being true (`prefs-opted-in`), but that is not equivalent to OS permission or consent; it can hide the prompt for users who never granted OS permission while still allowing other manual paths.

Implementation plan after approval:

1. Harden phone portrait lock at runtime
- Update `MainActivity.java` to log the physical/device classification more explicitly: `smallestScreenWidthDp`, `screenLayout`, `isTablet`, target orientation constant, and `requestedOrientationAfter`.
- Change the phone/tablet decision so phone builds do not accidentally unlock rotation just because a foldable/large phone reports `sw >= 600`.
- Keep tablet support only for clearly tablet-class devices, and log the branch used.
- Add the Android 16/API 36 restricted-resizability compatibility property in `AndroidManifest.xml` so orientation restrictions are respected where Android still allows opt-out.
- If needed, lower `targetSdkVersion` from 36 to 35 in `android/variables.gradle` as a release-blocker workaround, because API 36 changes can ignore orientation restrictions on large-screen classifications. I will only do this if the manifest/runtime hardening is not sufficient from code inspection.

2. Make notification prompting fully centralized
- Add/extend a single gate function so every visible prompt opening must pass through one decision path.
- Update `Profile.tsx` so the manual notification preferences button logs and audits before opening the sheet; if OS permission is already granted or consent exists, it will suppress the sheet and log the exact reason.
- Update `NotificationConsentSheet.tsx` so `handleEnable()` performs a final preflight permission check and logs before any native call. If OS permission is already granted, it saves consent and closes without calling `requestPermissions()`.
- Add explicit logs for:
  - prompt shown vs suppressed
  - source (`shell`, `onboarding`, `profile-settings`, `sheet-enable`)
  - local consent
  - profile consent
  - OS permission
  - whether `requestPermissions()` was called
  - whether `register()` was called

3. Stop native crash paths from push registration
- Update `src/lib/pushFcm.ts` so `requestNativePush()` never calls `register()` unless native push registration is known safe.
- Add a timeout wrapper around native permission/register promises so resume/re-render cannot hang the JS path.
- Add a config guard for missing native Firebase config: if FCM native config is not present in the APK, log a suppression/registration-skip reason instead of calling `PushNotifications.register()`.
- If native FCM is not configured in the repo, prompt registration will save consent but skip FCM token registration until `android/app/google-services.json` is added. This avoids app crashes while preserving the permission UX.

4. Build script evidence only, no stale-build changes
- I will not change the build freshness logic.
- I may add verification strings to the existing build output only if needed to help confirm the runtime fix is packaged.

Expected verification commands after the fix:

```bash
adb logcat -c
adb shell am force-stop com.mi4labs.carnivorex
adb shell monkey -p com.mi4labs.carnivorex 1
adb logcat -v time -s CarnivoreXOrientation
```

Expected orientation logs:

```text
I/CarnivoreXOrientation: stage=before-super ... isTablet=... target=SCREEN_ORIENTATION_PORTRAIT constant=1 requestedOrientationAfter=1
I/CarnivoreXOrientation: stage=after-super ... target=SCREEN_ORIENTATION_PORTRAIT constant=1 requestedOrientationAfter=1
```

Notification verification:

```bash
adb logcat -c
adb shell am force-stop com.mi4labs.carnivorex
adb shell monkey -p com.mi4labs.carnivorex 1
adb logcat -v time | grep -E 'PushDecision|PushNative|Capacitor/Plugin|Firebase|FATAL EXCEPTION'
```

Expected suppression for an already-enabled user:

```text
[PushDecision] source=shell branch=suppress reason=os-already-granted
[PushDecision] source=... branch=sheet-suppressed ...
```

Expected native-call evidence:

```text
[PushDecision] source=requestNativePush branch=requestPermissions-call
```

should appear only after a user taps Enable and only when OS permission is not already granted. If native FCM config is absent, you should see a registration skip log instead of a crash.