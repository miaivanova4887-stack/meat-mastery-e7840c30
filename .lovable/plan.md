## Problem

Xcode reports `Unable to resolve module dependency: 'FirebaseCore' / 'FirebaseMessaging'` when building `AppDelegate.swift`.

Root cause confirmed by inspecting `ios/App/App.xcodeproj/project.pbxproj`:

- The App target links only one package product: the local `CapApp-SPM` package.
- `Firebase` is declared as a dependency of the `CapApp-SPM` target inside `ios/App/CapApp-SPM/Package.swift`, but `FirebaseCore` / `FirebaseMessaging` are **not** linked to the `App` target itself.
- `AppDelegate.swift` lives in the App target, not in the SPM package, so it cannot `import FirebaseCore` — the modules aren't visible to that target.
- `grep -i firebase ios/App/App.xcodeproj/project.pbxproj` returns nothing, confirming no `XCRemoteSwiftPackageReference` / product dependency exists for Firebase in the Xcode project.

This is why iOS never reached the runtime push code at all — the build never completed.

## Fix Strategy

Avoid hand-editing `project.pbxproj` (fragile and gets clobbered by `npx cap sync`). Instead, **move all Firebase code into the `CapApp-SPM` Swift package** (which already declares Firebase as a dependency and compiles fine), and have `AppDelegate.swift` call into it. The App target only needs to `import CapApp_SPM` — no new Xcode package wiring required.

### Files to change

1. `**ios/App/CapApp-SPM/Sources/CapApp-SPM/CapApp-SPM.swift**` — replace placeholder with a `CarnivoreXPush` helper:
  - `public final class CarnivoreXPush: NSObject, MessagingDelegate`
  - `public static let shared = CarnivoreXPush()`
  - `public func configure()` — calls `FirebaseApp.configure()`, sets `Messaging.messaging().delegate = self`. Logs `[Push] FirebaseApp.configure done`.
  - `public func handleAPNsToken(_ deviceToken: Data, window: UIWindow?)` — logs APNs token length, sets `Messaging.messaging().apnsToken = deviceToken`, posts the `Capacitor.didRegisterForRemoteNotificationsWithDeviceToken` NSNotification (preserves Capacitor PushNotifications plugin behavior).
  - `public func handleAPNsError(_ error: Error)` — logs `[Push] registrationError` and posts `Capacitor.didFailToRegisterForRemoteNotificationsWithError`.
  - `MessagingDelegate.messaging(_:didReceiveRegistrationToken:)` — logs FCM token length, dispatches the `fcm-token` JS CustomEvent via the active `CAPBridgeViewController`'s webview (uses `UIApplication.shared.connectedScenes` to locate the key window, since `window` here is not retained).
  - Holds reference to itself via `shared` to keep the delegate alive.
2. `**ios/App/App/AppDelegate.swift**` — strip Firebase imports/code, delegate to the package:
  - Remove `import FirebaseCore`, `import FirebaseMessaging`, and `MessagingDelegate` conformance.
  - Add `import CapApp_SPM`.
  - `didFinishLaunchingWithOptions` calls `CarnivoreXPush.shared.configure()`.
  - `didRegisterForRemoteNotificationsWithDeviceToken` calls `CarnivoreXPush.shared.handleAPNsToken(deviceToken, window: window)`.
  - `didFailToRegisterForRemoteNotificationsWithError` calls `CarnivoreXPush.shared.handleAPNsError(error)`.
  - Keep existing `application(_:open:)` and `continue userActivity` proxy methods untouched.
3. `**ios/App/CapApp-SPM/Package.swift**` — already lists `firebase-ios-sdk` as a dependency, and the `CapApp-SPM` target already pulls in `FirebaseCore` + `FirebaseMessaging` products. No change needed. `Capacitor` is already a dependency of the target, so `CAPBridgeViewController` is available.

### Why this resolves the build error

Once Firebase usage lives inside `CapApp-SPM`, only that package needs Firebase resolved — which it already does (its `Package.swift` declares it and SPM resolves it). The App target's existing single link to `CapApp-SPM` is sufficient; `AppDelegate.swift` no longer references Firebase symbols, so the missing module imports disappear.

### Verification steps for the user (after build mode applies the changes)

```bash
cd ~/Desktop/carnivore-coach-pro
git pull
npm install
npx cap sync ios
cd ios/App
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
rm -rf App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App
open App.xcodeproj
```

Then in Xcode: Product → Clean Build Folder → Run on iPhone.

Expected: build succeeds; on launch, Xcode console shows `[Push] FirebaseApp.configure done`. After tapping "Send test reminder" as admin, the `[Push] requestPermissions called` → `result receive=…` → `register called` → `iOS APNs token registered len=…` → `FCM token registered len=…` sequence appears, and iOS Settings → CarnivoreX gains a Notifications section.

Approved. The root-cause analysis is sound:

Firebase is not linked to the App target,

AppDelegate lives in the App target,

so direct import FirebaseCore / FirebaseMessaging in AppDelegate cannot work.

I agree with the workaround:

move all Firebase-specific native code into CapApp-SPM,

keep AppDelegate.swift thin and only delegate into CapApp_SPM,

avoid fragile project.pbxproj edits that can be clobbered by Capacitor sync.

Two requirements:

Preserve Capacitor push notifications behavior by reposting the native registration success/failure notifications exactly as before.

Verify the package can reliably find the active Capacitor bridge/webview to dispatch the fcm-token JS event.

After implementation, I want:

successful iOS build,

[Push] FirebaseApp.configure done on launch,

the full permission → APNs → FCM → persisted-token sequence,

Notifications appearing in iOS Settings for the app.

### Out of scope

- No changes to the JS-side push code (`pushFcm.ts`, `CoachingReminderSettings.tsx`, `pushDecision.ts`) — those are already correct and will take effect once the native build succeeds.
- No `project.pbxproj` edits, so `npx cap sync ios` remains safe.