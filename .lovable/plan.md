I audited the runtime paths, not the build pipeline. The fresh build path does not need more changes.

Files currently responsible for the remaining runtime issues:
- `android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java`: orientation lock is applied only after `super.onCreate(...)`, and the manifest has no `android:screenOrientation` fallback. If the first WebView/activity configuration is created before the lock sticks on the device/OEM, the UI can still enter landscape.
- `android/app/src/main/AndroidManifest.xml`: no early activity-level portrait orientation override exists today.
- `src/pages/Onboarding.tsx`: after onboarding/Health Connect, it unconditionally opens `NotificationConsentSheet` with `setShowPushConsent(true)` and only marks `push-prompt-shown`; it does not check local consent, profile consent, or OS permission before showing the sheet.
- `src/pages/Profile.tsx`: the notification preferences row unconditionally opens `NotificationConsentSheet`. This is OK for an explicit settings action, but it currently lacks a branch log to distinguish manual-open from automatic prompt.
- `src/components/PushConsentFallbackHost.tsx` + `src/hooks/usePushConsentFallback.ts`: this is the app-level automatic prompt path and already has suppression checks, but the logs are inconsistent (`[Push]` and `[PushDecision]`) and do not emit one single full state snapshot before the decision.
- `src/components/NotificationConsentSheet.tsx` + `src/lib/pushFcm.ts`: native permission/register calls are guarded, but the sheet itself is still reachable from Onboarding without suppression checks, so a logged-in user with active notifications can still see the prompt and tap into native permission logic.
- `src/pages/KetosisTimer.tsx`: separate web notification path exists (`Notification.requestPermission()` / `subscribeToPush()`), but `subscribeToPush()` returns false on native, so this is not the Android native crash path. I will add no native prompt work there unless needed.

Plan:

1. Harden phone portrait lock at the earliest Android runtime point
- In `MainActivity.java`, add a small `applyPhonePortraitLock(stage)` helper that:
  - detects tablet mode using `smallestScreenWidthDp >= 600`
  - applies `ActivityInfo.SCREEN_ORIENTATION_PORTRAIT` on phones
  - logs the stage, tablet detection, applied orientation constant, and `getRequestedOrientation()` after application
- Call this helper before `super.onCreate(...)`, then again immediately after `super.onCreate(...)`, and inside `onConfigurationChanged(...)`.
- Keep tablet rotation behavior unchanged.
- Add `android:screenOrientation="portrait"` to `MainActivity` in `AndroidManifest.xml` as the early manifest-level fallback, because the user reports the runtime call alone still allows rotation. This is stricter for the phone activity. If tablet rotation must remain dynamic in the same activity, the Java code will still log tablet detection; however, Android manifest orientation is static. Given the explicit blocker is phone landscape, the manifest fallback is the reliable fix.

Expected launch log lines after implementation:
```text
I/CarnivoreXOrientation: stage=before-super tablet=false smallestScreenWidthDp=<value> applying=SCREEN_ORIENTATION_PORTRAIT constant=1
I/CarnivoreXOrientation: stage=before-super requestedOrientationAfter=1
I/CarnivoreXOrientation: stage=after-super tablet=false smallestScreenWidthDp=<value> applying=SCREEN_ORIENTATION_PORTRAIT constant=1
I/CarnivoreXOrientation: stage=after-super requestedOrientationAfter=1
```
If a configuration change occurs:
```text
I/CarnivoreXOrientation: stage=onConfigurationChanged tablet=false smallestScreenWidthDp=<value> applying=SCREEN_ORIENTATION_PORTRAIT constant=1
I/CarnivoreXOrientation: stage=onConfigurationChanged requestedOrientationAfter=1
```

2. Collapse notification automatic prompting into one logged decision path
- Add a shared helper in the existing push consent hook/module path that performs the full suppression audit before any sheet is opened:
  - `localConsent`
  - `userId/userPresent`
  - `profileConsent`
  - whether `notification_preferences` indicate opt-in
  - Android OS permission state from `getNativePushPermission()`
  - final decision: `show-sheet` or a specific suppression reason
- Reuse this helper from:
  - `usePushConsentFallback("shell")`
  - onboarding completion before setting `showPushConsent(true)`
- This removes the currently broken Onboarding path that opens the native sheet without the same suppression checks as the app-level host.

Expected branch logs:
```text
[PushDecision] source=shell branch=start localConsent=<unset|granted|denied> userPresent=<true|false>
[PushDecision] source=shell branch=profile profileConsent=<unset|granted|denied|null> prefsOptedIn=<true|false>
[PushDecision] source=shell branch=os osPermission=<granted|denied|prompt|prompt-with-rationale|unsupported>
[PushDecision] source=shell branch=suppress reason=<already-shown-session|local-consent-set|profile-consent-set|prefs-opted-in|os-already-granted|anonymous-not-progressed>
```
Or when the prompt is legitimate:
```text
[PushDecision] source=shell branch=show-sheet reason=eligible
```
For onboarding:
```text
[PushDecision] source=onboarding branch=start ...
[PushDecision] source=onboarding branch=suppress reason=os-already-granted
```
or:
```text
[PushDecision] source=onboarding branch=show-sheet reason=eligible
```

3. Prevent native notification calls unless the sheet is legitimately open and the user taps enable
- Keep `requestNativePush()` as the only Android native request/register function.
- In `requestNativePush()`, add exact logs before any native plugin call:
```text
[PushDecision] source=requestNativePush branch=check-os-before-request
[PushDecision] source=requestNativePush branch=requestPermissions-call
[PushDecision] source=requestNativePush branch=register-call reason=<os-already-granted|fresh-grant>
```
- Ensure every `requestPermissions()` and `register()` call remains inside `try/catch` and logs swallowed errors.
- In `NotificationConsentSheet.tsx`, log manual vs automatic sheet enable, and re-check OS permission before calling `requestNativePush()`.
- For already granted OS permission, save/reconcile consent and close the sheet without calling `requestPermissions()`.

4. Make explicit Profile settings behavior distinguishable from automatic prompts
- Keep the Profile notification row as an explicit user action, but add a log when it opens:
```text
[PushDecision] source=profile-settings branch=manual-open
```
- This lets logcat prove whether a prompt was automatic or caused by the user tapping Settings.

5. Validation commands to run on device after rebuild/install
Portrait launch/orientation evidence:
```bash
adb logcat -c
adb shell am force-stop com.mi4labs.carnivorex
adb shell settings put system accelerometer_rotation 1
adb shell settings put system user_rotation 1
adb shell monkey -p com.mi4labs.carnivorex 1
adb logcat -d -s CarnivoreXOrientation
```
Expected: before-WebView logs with `tablet=false`, `constant=1`, `requestedOrientationAfter=1`.

Force a landscape rotation attempt:
```bash
adb shell content insert --uri content://settings/system --bind name:s:user_rotation --bind value:i:1
adb logcat -d -s CarnivoreXOrientation
```
Expected: UI remains portrait; if configuration changes fire, `onConfigurationChanged` re-applies portrait and logs `requestedOrientationAfter=1`.

Notification decision logs:
```bash
adb logcat -c
adb shell am force-stop com.mi4labs.carnivorex
adb shell monkey -p com.mi4labs.carnivorex 1
adb logcat -d | grep -E "PushDecision|Push\]"
```
Expected for a logged-in user with active notifications: a suppression line, not `show-sheet`.

Prove no native permission request happened for already-granted users:
```bash
adb logcat -d | grep -E "requestPermissions-call|register-call|sheet-enable|show-sheet|suppress"
```
Expected: `suppress reason=os-already-granted` or `suppress reason=profile-consent-set`; no `requestPermissions-call` unless the sheet was actually shown and Enable was tapped.

Crash filter:
```bash
adb logcat -d | grep -E "AndroidRuntime|FATAL EXCEPTION|PushDecision|PushNotifications|Capacitor/Console"
```
Expected: no `AndroidRuntime` / `FATAL EXCEPTION`; any permission/plugin errors should be logged as swallowed warnings/errors under `[PushDecision]`.