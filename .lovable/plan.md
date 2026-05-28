# Fix: iOS SpeechRecognition plugin not implemented

## Exact root cause

`@capacitor-community/speech-recognition@7.0.1` ships an iOS class declared as:

```swift
@objc(SpeechRecognition)
public class SpeechRecognition: CAPPlugin { ... }
```

It does **not** conform to `CAPBridgedPlugin` and does **not** declare `identifier` / `jsName` / `pluginMethods`. Capacitor 7 with SPM (this project uses `capacitor-swift-pm` 8.3.0 via `ios/App/CapApp-SPM/Package.swift`) auto-registers plugins **only** when they conform to `CAPBridgedPlugin`. Result: the class is compiled and linked, but never registered with the bridge, so every JS call resolves to `"SpeechRecognition" plugin is not implemented on ios` — exactly what the logs show at `step= available`.

Secondary checks (all clean, no action needed):

- `@capacitor-community/speech-recognition` is present in `package.json` (`^7.0.1`).
- iOS SPM package already references it in `ios/App/CapApp-SPM/Package.swift` and `android/app/capacitor.build.gradle` references the Android module — install + sync wiring is fine.
- `Info.plist` contains `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`; no `WKAppBoundDomains` key is present, so domain restriction is not blocking plugin injection.
- The custom `AudioSessionPlugin` works because it explicitly conforms to `CAPBridgedPlugin` and is registered in `MainViewController.capacitorDidLoad` — confirming auto-registration works for compliant plugins and fails for this one specifically.

## Fix (smallest safe change)

Extend the existing `patch-package` patch `patches/@capacitor-community+speech-recognition+7.0.1.patch` to also modify `node_modules/@capacitor-community/speech-recognition/ios/Plugin/Plugin.swift`:

1. Change the class declaration to:
  ```swift
   public class SpeechRecognition: CAPPlugin, CAPBridgedPlugin {
       public let identifier = "SpeechRecognition"
       public let jsName = "SpeechRecognition"
       public let pluginMethods: [CAPPluginMethod] = [
           CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
           CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
           CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
           CAPPluginMethod(name: "isListening", returnType: CAPPluginReturnPromise),
           CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
           CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
           CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
       ]
       ...
   }
  ```

`patch-package` (already in the project, already patching this same plugin's Android proguard rules) will reapply this on every `npm install`, so the fix survives `node_modules` re-installs.

First patch the plugin to expose Capacitor bridge metadata. If the plugin still isn’t available after rebuild, add the minimal explicit iOS registration required for this project’s Capacitor/SPM setup.

## Files changed

- `patches/@capacitor-community+speech-recognition+7.0.1.patch` — extend with the iOS Plugin.swift hunk above.

No changes to:

- `MainViewController.swift` (auto-registration via SPM will now pick the plugin up; explicit registration not needed).
- `src/hooks/useVoiceCapture.ts` (already correct; the `step= available` catch will simply stop firing).
- `Info.plist`, auth, onboarding, paywall, purchases.

## Category of fix

Explicit plugin compliance patch via `patch-package`. **Not** an install/sync-only issue and **not** a WKAppBoundDomains issue.

## Post-fix steps

User runs:

```
npm install            # applies patch-package
npx cap sync ios
# Xcode → clean build folder → run
```

## Proof to confirm

After rebuild, voice tap logs should show, in order:

```
[VoiceLog] startListening listening= false isNative= true
[VoiceLog] iOS mic permission status before request = granted
[VoiceLog] after resetAudioSession ok
[VoiceLog] SR pre-check platform= ios language= en-US
[VoiceLog] SR permission status before request = { speechRecognition: "granted" }
[VoiceLog] recorder start invoked platform= ios language= en-US
[VoiceLog] recorder started
```

The line `SR availability/permission threw step= available err= ... plugin is not implemented on ios` must no longer appear. If it still does, the patch didn't apply — verify with `grep CAPBridgedPlugin node_modules/@capacitor-community/speech-recognition/ios/Plugin/Plugin.swift` returning a match.