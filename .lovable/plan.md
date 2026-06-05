# iOS Native Push (FCM/APNs) — enablement plan

`GoogleService-Info.plist` received (bundle `com.mi4labs.carnivorex`, project `carnivore-84bd2`, GCM sender `963699055181`). This plan turns on real iOS push so an admin's `Send test reminder` lands on the device.

## Prerequisite confirmations (you, outside Lovable)

Before this plan can succeed at runtime, please confirm all three:

1. **APNs Auth Key (.p8) uploaded to Firebase** → Firebase Console → Project Settings → Cloud Messaging → *Apple app configuration* → APNs Authentication Key (with Key ID + Team ID).
2. **Push Notifications capability enabled** on App ID `com.mi4labs.carnivorex` in Apple Developer Portal → Identifiers.
3. You are building with a provisioning profile that includes the Push Notifications entitlement (automatic signing in Xcode normally handles this once capability is added).

Code/config below is safe to ship even if 1–3 are still pending — registration will simply fail with a clear `registrationError` until they are in place.

## What gets changed

### A. Drop the plist into the iOS target

- Add `ios/App/App/GoogleService-Info.plist` (from upload).
- Register it in `ios/App/App.xcodeproj/project.pbxproj` so it's bundled into the app target (Copy Bundle Resources).

### B. iOS entitlements + Info.plist

- `ios/App/App/App.entitlements`: add `aps-environment = development` (Xcode automatically promotes to `production` for App Store builds via capability).
- `ios/App/App/Info.plist`: add `UIBackgroundModes` → `remote-notification`, and `FirebaseAppDelegateProxyEnabled = NO` (we'll forward APNs token to FCM ourselves so it composes cleanly with Capacitor's proxy).

### C. Firebase iOS SDK via SPM

- `ios/App/CapApp-SPM/Package.swift`: add `https://github.com/firebase/firebase-ios-sdk.git` (>= 11.0.0) and depend on products `FirebaseCore` + `FirebaseMessaging` in the `CapApp-SPM` target.

### D. AppDelegate wiring

- `ios/App/App/AppDelegate.swift`:
  - `import FirebaseCore`, `import FirebaseMessaging`, `import UserNotifications`.
  - In `didFinishLaunchingWithOptions`: `FirebaseApp.configure()`, set `Messaging.messaging().delegate = self`, set `UNUserNotificationCenter.current().delegate = self`.
  - Implement `didRegisterForRemoteNotificationsWithDeviceToken` → `Messaging.messaging().apnsToken = deviceToken`.
  - Implement `didFailToRegisterForRemoteNotificationsWithError` → log + forward to Capacitor PushNotifications via `NotificationCenter` (the Capacitor plugin already observes these).
  - Conform to `MessagingDelegate.messaging(_:didReceiveRegistrationToken:)` → forward FCM token to Capacitor PushNotifications `registration` event so the existing JS listener in `src/lib/pushFcm.ts` calls `register-device-token`.
  - Conform to `UNUserNotificationCenterDelegate` for foreground presentation (banner/sound) and tap routing.

### E. JS gating split

- `src/lib/pushNativeConfig.ts`: replace single `NATIVE_FCM_ENABLED` with `NATIVE_FCM_ENABLED_IOS = true` and `NATIVE_FCM_ENABLED_ANDROID = false`, plus helper `isNativeFcmEnabled()` that reads `Capacitor.getPlatform()`.
- `src/lib/pushFcm.ts`: swap all `NATIVE_FCM_ENABLED` reads for `isNativeFcmEnabled()` so iOS now actually calls `PushNotifications.register()` while Android stays disabled.

### F. Token lifecycle hardening (iOS only)

- In `src/lib/pushFcm.ts`, add `App.addListener('appStateChange', ...)` that re-calls `PushNotifications.register()` on `isActive=true` when consent is `granted` and platform is iOS (FCM token can rotate; cheap idempotent call).
- Bind `registrationError` once to surface APNs failures into console with a stable tag (`[Push] iOS registrationError`) so we can read them from Xcode console / Console.app.

### G. Admin gating (already in place — keep + reverify)

- Frontend: `CoachingReminderSettings.tsx` continues to hide Send test reminder unless `has_role('admin')`.
- Backend: `supabase/functions/coaching-reminder-test/index.ts` continues to return **403** for non-admin callers (already implemented).

## Out of scope (do not change)

- Android FCM (`google-services.json`) — still disabled.
- Web push (VAPID) — unchanged.
- Writing test sends to `coaching_reminder_log` — admin audit stays cron-only.

## Verification (line-by-line, after Lovable applies the change)

```bash
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → **+ Capability** → **Push Notifications**.
2. **+ Capability** → **Background Modes** → tick **Remote notifications**.
3. Confirm `GoogleService-Info.plist` appears under *Build Phases → Copy Bundle Resources*.
4. Select a real iPhone (push does **not** work in the iOS Simulator).
5. Cmd+R to build & run; allow notifications when prompted.

In the app:
6. Sign in as the admin account.
7. Open Xcode console, filter on `[Push]` — expect:

- `[Push] checkPermissions receive=granted`
- `[Push] FCM token registered len=<140–170>`

In Lovable Cloud:
8. `SELECT user_id, platform, length(token) FROM device_tokens WHERE platform='ios' ORDER BY updated_at DESC LIMIT 5;` — confirm a fresh iOS row for your user.

In the app:
9. Profile → Coaching Call Reminders → **Send test reminder**.
10. Edge logs for `coaching-reminder-test` should show:
    `[reminder-test] sent { code: "ok", deliveredNative: 1, fcmAttempts: 1, ... }` and a push banner appears on the device.

If step 7 logs `registrationError`, that's the APNs/Firebase config (prereqs 1–3) — the message body will name the cause (`no valid "aps-environment"`, `BadDeviceToken`, etc.) and we'll address it without further code changes.

## Risk notes

- Setting `FirebaseAppDelegateProxyEnabled=NO` means we *must* assign `apnsToken` manually — already covered in step D. If left at default (`YES`), it would also work but can collide with Capacitor's swizzling on some Capacitor versions; explicit is safer.
- SPM resolution adds ~30 MB to the iOS build's first compile and ~6 MB to the IPA. Acceptable for this app.

User: Approved with one clarification:

Proceed with A–G as written.

Keep FirebaseAppDelegateProxyEnabled = NO and manual APNs token forwarding exactly as described.

Also verify notification tap/deep-link handling still works correctly through the Capacitor push flow after the AppDelegate changes.

For aps-environment, please validate the actual entitlement in the built app/profile used for testing rather than assuming Xcode will always “promote” it correctly.

Once implemented, I’ll rebuild on a physical iPhone and verify:

[Push] checkPermissions receive=granted

[Push] FCM token registered len=...

fresh device_tokens row with platform='ios'

successful admin test reminder delivery end-to-end.