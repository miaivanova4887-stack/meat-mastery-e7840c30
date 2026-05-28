## Root Cause

The Xcode build fails with 8 "Missing package product" errors (CapacitorApp, CapacitorBrowser, CapacitorCommunityTextToSpeech, CapacitorPushNotifications, CapacitorShare, CapgoCapacitorSocialLogin, RevenuecatPurchasesCapacitor, CapacitorNativeSettings) — even though those plugins ARE declared in `ios/App/CapApp-SPM/Package.swift`.

The reason all 8 show as missing is a cascade failure: when SwiftPM cannot resolve **one** local package dependency, it aborts the whole graph and every product in `CapApp-SPM` is reported missing.

The failing package is `@capacitor-community/speech-recognition@7.0.1`:

```
$ ls node_modules/@capacitor-community/speech-recognition/
CapacitorCommunitySpeechRecognition.podspec  LICENSE  README.md  android  dist  ios  package.json
```

There is **no `Package.swift`** in that plugin. v7.0.1 only ships a CocoaPods podspec. But `CapApp-SPM/Package.swift` references it as an SPM dependency:

```swift
.package(name: "CapacitorCommunitySpeechRecognition",
         path: "../../../node_modules/@capacitor-community/speech-recognition"),
```

SwiftPM can't load the manifest → entire dependency graph fails → every other plugin is reported as a "Missing package product". The earlier `CAPBridgedPlugin` patch is correct and needed, but it does nothing until SPM can actually compile the plugin.

## Fix (Smallest Safe Change)

Add a `Package.swift` to the plugin via `patch-package` so it persists across `npm install`. The patch will also remove the old `Plugin.m`/`Plugin.h` from the SPM build (they call the legacy `CAP_PLUGIN` macro which is incompatible with `CAPBridgedPlugin` and would cause duplicate registration if compiled twice).

### Files changed

1. **`patches/@capacitor-community+speech-recognition+7.0.1.patch`** — extend the existing patch with a third hunk that creates `node_modules/@capacitor-community/speech-recognition/Package.swift` with this content:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorCommunitySpeechRecognition",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorCommunitySpeechRecognition",
            targets: ["CapacitorCommunitySpeechRecognition"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorCommunitySpeechRecognition",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist", "Plugin.h", "Plugin.m"],
            sources: ["Plugin.swift"]
        )
    ]
)
```

2. **`node_modules/@capacitor-community/speech-recognition/Package.swift`** — same file written locally so the next build works without re-running install (patch-package re-applies on every `npm install`).

No changes to `ios/App/CapApp-SPM/Package.swift`, the Xcode project, the voice hook, or any other code.

## Line-by-Line Verification Steps (macOS)

```bash
cd ~/path/to/carnivore-coach-pro
git pull
rm -rf node_modules
npm install
# Confirm patch produced the new manifest:
ls node_modules/@capacitor-community/speech-recognition/Package.swift
grep CAPBridgedPlugin node_modules/@capacitor-community/speech-recognition/ios/Plugin/Plugin.swift
npx cap sync ios
cd ios/App
# Force SPM to re-resolve from scratch:
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
xed .
```

In Xcode:
1. File → Packages → Reset Package Caches
2. File → Packages → Resolve Package Versions
3. Product → Clean Build Folder (Shift+Cmd+K)
4. Build (Cmd+B)

## Expected Evidence of Success

- The 8 "Missing package product" errors disappear.
- Build succeeds.
- After mic tap on device, console shows the full sequence with no `plugin is not implemented on ios`:
  ```
  [VoiceLog] startListening listening= false isNative= true
  [VoiceLog] after resetAudioSession ok
  [VoiceLog] SR pre-check platform= ios language= en-US
  [VoiceLog] SR permission status before request = { speechRecognition: "granted" }
  [VoiceLog] recorder start invoked platform= ios language= en-US
  [VoiceLog] recorder started
  ```
