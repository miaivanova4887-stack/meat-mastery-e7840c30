## Diagnosis

`ios/App/CapApp-SPM/Package.swift` does declare `firebase-ios-sdk` as a dependency and lists `FirebaseCore` / `FirebaseMessaging` as target products — that part is correct. But:

1. `**Package.resolved` has not been refreshed.** The current file pins only `capacitor-swift-pm`, `purchases-hybrid-common`, and `purchases-ios-spm` — no `firebase-ios-sdk` entry. Xcode is still operating on the old resolution graph, so the Firebase modules genuinely don't exist in the build, exactly as the errors say.
2. `**Package.swift` is marked "DO NOT MODIFY — managed by Capacitor CLI".** The next `npx cap sync ios` will rewrite it from `node_modules` and silently strip the Firebase dependency, putting us right back here. The wrapper-package approach is structurally fragile.

The fix is the one the user is already pointing at: stop fighting the local SPM wrapper and integrate Firebase **directly** into `App.xcodeproj` as a remote Swift package, where Capacitor's sync will not touch it.

## Plan

### 1. Revert the wrapper-package detour

- `ios/App/CapApp-SPM/Package.swift` — remove the `firebase-ios-sdk` package dependency and the `FirebaseCore` / `FirebaseMessaging` products from the `CapApp-SPM` target. Restore it to the Capacitor-managed shape so future `cap sync` runs are a no-op on this file.
- `ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift` — return to the original placeholder. The `CarnivoreXPush` helper moves into the App target.

### 2. Add Firebase as a remote SPM package on the App project

Edit `ios/App/App.xcodeproj/project.pbxproj` to add:

- An `XCRemoteSwiftPackageReference` for `https://github.com/firebase/firebase-ios-sdk.git` with `minimumVersion = 11.0.0`, registered in the project's `packageReferences` list (alongside the existing local `CapApp-SPM` reference).
- Two `XCSwiftPackageProductDependency` entries (`FirebaseCore`, `FirebaseMessaging`) tied to that package reference.
- Both product dependencies added to the **App** target's `packageProductDependencies` and to the `Frameworks` build phase (`PBXBuildFile` + `PBXFrameworksBuildPhase` files list) so they actually link.

### 3. Move the push bridge into the App target

- New file `ios/App/App/CarnivoreXPush.swift` containing `FirebaseApp.configure()`, the `MessagingDelegate` implementation, APNs token forwarding, and the `evaluateJavaScript("window.dispatchEvent(new CustomEvent('fcm-token', …))")` bridge. Register it in `project.pbxproj` (PBXFileReference + PBXBuildFile + Sources build phase + App group), same pattern as `HealthConnectPlugin.swift`.
- `ios/App/App/AppDelegate.swift` — keep the current shape, just drop `import CapApp_SPM` (the helper now lives in the App target) and call `CarnivoreXPush.shared.configure()` / `handleAPNsToken` / `handleAPNsError` directly.

### 4. Force a clean resolution

After the edits, the user runs the line-by-line cleanup from `~/Desktop/carnivore-coach-pro`:

```bash
git pull
npm install
npx cap sync ios
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
rm -rf ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
rm -rf ios/App/.build ios/App/CapApp-SPM/.build
cd ios/App
xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App
```

Expected: the resolve step prints fetches for `firebase-ios-sdk`, `GoogleUtilities`, `GoogleDataTransport`, `nanopb`, `abseil`, `grpc-binary`, `gtm-session-fetcher`, `promises`, `swift-protobuf`, and a refreshed `Package.resolved` now contains a `firebase-ios-sdk` pin. Then open Xcode → clean build → run on device.

### 5. Evidence to return

- `Package.resolved` diff showing the new `firebase-ios-sdk` pin.
- Xcode → App target → General → "Frameworks, Libraries, and Embedded Content" listing `FirebaseCore` and `FirebaseMessaging`.
- Xcode console on launch: `[Push] FirebaseApp.configure done`.
- After tapping "Send test reminder" as admin: the full `[Push] requestPermissions called → register called → iOS APNs token registered (xx bytes) → FCM token registered (…)` sequence.
- iOS Settings → CarnivoreX now shows a **Notifications** section.

## Why this resolves it

- Firebase becomes a first-class App-target dependency that `npx cap sync ios` cannot rewrite away, so the resolution is stable across rebuilds.
- `AppDelegate.swift` and `CarnivoreXPush.swift` live in the same target where Firebase is linked, so `import FirebaseCore` / `import FirebaseMessaging` resolve directly — no cross-package import gymnastics.
- Deleting `Package.resolved` + DerivedData forces SwiftPM to re-pin from scratch, which is the only way to recover from the current stale resolution graph.

Approved. This is the first plan that targets the right integration layer.

I agree with:

abandoning the Capacitor-managed CapApp-SPM Firebase workaround,

restoring CapApp-SPM to a Capacitor-managed state,

adding Firebase directly to App.xcodeproj as a remote Swift package,

moving CarnivoreXPush.swift into the App target,

forcing a full package re-resolution by deleting stale resolution artifacts.

Two requirements:

Prefer real Xcode-equivalent package wiring over fragile raw project.pbxproj edits where possible.

After implementation, I need proof that the App target itself links FirebaseCore and FirebaseMessaging, not just that files were changed.

Required evidence:

refreshed Package.resolved containing firebase-ios-sdk

App target lists FirebaseCore and FirebaseMessaging

[Push] FirebaseApp.configure done

full iOS permission → APNs → FCM → persisted token sequence

## Out of scope

- No changes to JS-side push logic (`pushFcm.ts`, `pushDecision.ts`, `CoachingReminderSettings.tsx`, `usePushConsentFallback.ts`) — those are already correct.
- No Android changes.
- No Supabase / edge-function changes.