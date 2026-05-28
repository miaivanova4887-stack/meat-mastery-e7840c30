# iOS voice + onboarding gate fixes

## 1) Voice log — diagnosis

`ios/App/App/Info.plist` already contains `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`, so the *strings* are fine. The reason CarnivoreX never appears under **Settings → Privacy & Security → Microphone** is that the OS only adds an app to that list **after iOS has prompted the user for the mic** at least once.

In our flow (`src/hooks/useVoiceCapture.ts` ~L201-238), the first thing we do on iOS is:

1. `AudioSession.resetAudioSession()` → `AVAudioSession.setActive(true)`.
2. `SpeechRecognition.checkPermissions()` / `requestPermissions()` (capacitor-community plugin).

Neither of these triggers the **microphone** permission prompt:

- `AVAudioSession.setActive` never prompts; if mic is undetermined it silently fails to route input.
- `@capacitor-community/speech-recognition`'s `requestPermissions` on iOS only calls `SFSpeechRecognizer.requestAuthorization` (Speech Recognition), not `AVAudioApplication.requestRecordPermission`.

The mic prompt is supposed to be triggered later by `AVAudioEngine.prepare/start` inside the plugin's `start()`, but our `resetAudioSession` runs first and the engine call then throws before the OS prompt is shown — so the user never sees the dialog and the app never gets listed in Settings.

## 2) Voice log — fix

**a) Add a native mic-permission method to our existing `AudioSessionPlugin`** (`ios/App/App/AudioSessionPlugin.swift`):

- New `requestMicrophonePermission(_:)` that calls `AVAudioApplication.requestRecordPermission` (iOS 17+) with a fallback to `AVAudioSession.sharedInstance().requestRecordPermission` on older iOS, and resolves `{ status: "granted" | "denied" | "undetermined" }`.
- New `checkMicrophonePermission(_:)` that reads `AVAudioApplication.shared.recordPermission` (or `AVAudioSession.sharedInstance().recordPermission`) without prompting.
- Register both methods in `pluginMethods` and add them to the JS shim type in `useVoiceCapture.ts`.

**b) Call it from `useVoiceCapture.startVoice` before any audio-session work** (iOS-only branch, before `resetAudioSession`):

```
[VoiceLog] iOS mic permission status before request = <status>
[VoiceLog] iOS mic permission request invoked
[VoiceLog] iOS mic permission result = <granted|denied>
```

If denied → call `onPermissionBlocked?.()` and return false (same as the SR-denied path) so the existing "Open Settings" sheet appears.

**c) Add the requested structured logs** at the existing key points in `startVoice`:

- `[VoiceLog] SR permission status before request = ...`
- `[VoiceLog] SR permission request invoked`
- `[VoiceLog] SR permission result = ...`
- `[VoiceLog] recorder start invoked platform=ios|android|web`
- `[VoiceLog] recorder started`
- `[VoiceLog] recorder failed err=...`

(Native plugin side already logs internally; we only need JS-side logs to verify the path in Safari Web Inspector / logcat.)

**d) Verification**: confirm Info.plist key on disk (already present) and that `MainViewController.swift` still registers `AudioSessionPlugin` (it does — no change needed).

## 3) Onboarding — diagnosis

Gate (`src/pages/Onboarding.tsx` L882) requires **both**:

- `localStorage["carnivore-onboarding-complete-v3"] === "true"`, **and**
- a non-empty `localStorage["carnivore-onboarding-answers"]`.

On a *true* uninstall, iOS wipes the app sandbox (WKWebView storage included). But the iOS app **has no opt-out from iCloud / device-to-device migration backup of the WKWebView data store**, so when the user installs a new TestFlight build on a device that was restored from backup — or upgrades in place — `localStorage` (and therefore both onboarding keys) survives. Result: onboarding is skipped on what the user perceives as a "fresh" install.

Android already handles this via `android/app/src/main/res/xml/backup_rules.xml` (excludes WebView storage). iOS has no equivalent.

## 4) Onboarding — fix (smallest safe)

Use a **non-backed-up install marker** to detect a genuinely fresh install and clear stale onboarding flags exactly once.

- Add `@capacitor/filesystem` (already transitively available via Capacitor; add to `package.json` if not present) and write a marker file to `Directory.Cache` (`carnivorex-install-marker`) — Cache directory is **never** included in iCloud / device backups.
- On app boot, in a new tiny helper `src/lib/installMarker.ts`, run once:
  1. Try to read the marker file.
  2. If missing → this is a fresh install (or a restore that dropped Cache).
     - `localStorage.removeItem("carnivore-onboarding-complete-v3")`
     - `localStorage.removeItem("carnivore-onboarding-answers")`
     - `localStorage.removeItem("carnivore-onboarding-body")`
     - Write the marker file with the current bundle version.
     - Log `[Onboarding] fresh-install detected, cleared onboarding flags`.
  3. If present → log `[Onboarding] install marker present, keeping flags`.
- Invoke this helper from `src/main.tsx` *before* `ReactDOM.render`, awaited, so the Index gate sees the corrected state on first paint.
- Web/Android behavior unchanged in practice (Android already has backup exclusion; web has no concept of "install"), but the helper is platform-agnostic and harmless on those targets.

## 5) Out of scope

- Standalone $99.99 coaching purchase, Pro/Free tier paywall, Auth screens, Push.
- Re-prompting onboarding for existing users who legitimately completed it (the marker is created on first boot of this build, so existing users keep their flags as long as Cache survives — which on iOS only resets on full reinstall, exactly the intended trigger).

## 6) Test checklist

1. iOS fresh install (delete app → reinstall) → onboarding shows; voice log first tap shows iOS mic prompt; CarnivoreX appears in **Settings → Privacy & Security → Microphone**.
2. iOS in-place TestFlight update of an already-onboarded user → onboarding does **not** retrigger; voice log works without re-prompting.
3. iOS denied mic → "Open Settings" sheet appears, no crash.
4. Android: voice + onboarding behavior unchanged.
5. Console shows the new `[VoiceLog] …` and `[Onboarding] …` lines in order.
