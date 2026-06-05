## Goal

Make a signed-in admin on iOS land a valid FCM-routable device token in `device_tokens` on app launch / foreground, so **Send test reminder** delivers end-to-end. Keep the existing admin-only gate.

## Confirmation

- Native iOS push registration is **currently disabled by design** in this build (`NATIVE_FCM_ENABLED = false` in `src/lib/pushNativeConfig.ts`). The flag was added to protect Android (no `google-services.json`), but it disables iOS too.
- Even after flipping the flag, iOS cannot produce a token the backend dispatcher can use, because the iOS target is missing: push entitlement, APNs delegate methods, Firebase iOS SDK, `GoogleService-Info.plist`, and APNs Auth Key uploaded to Firebase.

## Prerequisites you (the user) must provide

These cannot be generated from the sandbox.

1. **GoogleService-Info.plist** for bundle id `com.mi4labs.carnivorex` — download from the Firebase Console → Project Settings → iOS app. Upload it to me, I'll drop it into `ios/App/App/GoogleService-Info.plist`.
2. **APNs Auth Key (.p8)** — generated once in Apple Developer Portal → Keys → "+" → Apple Push Notifications service (APNs). Note the **Key ID** and your **Team ID**. Upload the `.p8` + Key ID + Team ID to the Firebase Console → Project Settings → Cloud Messaging → Apple app configuration. (You don't share these with me; Firebase keeps them.)
3. **Push Notifications capability** enabled on App ID `com.mi4labs.carnivorex` in Apple Developer Portal → Identifiers.

Until #1 lands in the repo and #2/#3 are done in the consoles, no iOS device can produce an FCM token — flipping any flag is cosmetic.

## What I will change once #1 is uploaded

### A. iOS native plumbing
- `ios/App/App/App.entitlements`: add `aps-environment = development` (Xcode will swap to `production` on Release).
- `ios/App/App/Info.plist`: add `UIBackgroundModes` containing `remote-notification`, and `FirebaseAppDelegateProxyEnabled = false` so we control APNs token handoff.
- `ios/App/App/AppDelegate.swift`:
  - `import Firebase` and `import FirebaseMessaging`.
  - In `didFinishLaunchingWithOptions`: `FirebaseApp.configure()`, set `Messaging.messaging().delegate`, set `UNUserNotificationCenter.current().delegate`.
  - Implement `didRegisterForRemoteNotificationsWithDeviceToken` → `Messaging.messaging().apnsToken = deviceToken`.
  - Implement `didFailToRegisterForRemoteNotificationsWithError` → log only.
  - Conform to `MessagingDelegate.messaging(_:didReceiveRegistrationToken:)` — forward the FCM token to JS via a Capacitor notification so the existing `registration` listener fires.
- Add Firebase iOS pods via Swift Package Manager (Capacitor 7 uses SPM): `firebase-ios-sdk` with products `FirebaseMessaging`, `FirebaseAnalytics`. Update `ios/App/CapApp-SPM/Package.swift`.

### B. JS gating split
- Replace single `NATIVE_FCM_ENABLED` with platform-aware gates in `src/lib/pushNativeConfig.ts`:
  ```ts
  export const NATIVE_FCM_ENABLED_IOS = true;     // turn on with iOS Firebase wiring
  export const NATIVE_FCM_ENABLED_ANDROID = false; // stays off until google-services.json ships
  export function isNativeFcmEnabled(platform: 'ios' | 'android'): boolean { ... }
  ```
- Update `src/lib/pushFcm.ts` to consult `isNativeFcmEnabled(platform)` instead of the single flag.

### C. Token refresh on launch / foreground
- In `AuthContext` (or a dedicated `usePushBootstrap` hook mounted at app root): after sign-in, when `Capacitor.isNativePlatform()` and the user is admin **or** consent is granted, call `requestNativePush()` once. Already idempotent.
- Add a Capacitor `App` `appStateChange` listener: on `isActive=true`, if consent is granted and platform is iOS, call `PushNotifications.register()` so a refreshed FCM token re-fires the `registration` listener.

### D. Stale-token cleanup
- Already in place server-side: `sendFcmToToken` flags `UNREGISTERED` / `INVALID_ARGUMENT` / 404 as `invalid`, and both `coaching-reminder-test` and `coaching-reminder-dispatch` delete invalid `device_tokens` rows.
- Add a one-line client-side mop-up: when `registrationError` fires on iOS, log and surface a toast via a custom event so admins know.

### E. Admin gating (already done — keep)
- Frontend hides **Send test reminder** unless `useIsAdmin(user.id)` is true.
- `coaching-reminder-test` returns **403 `forbidden`** for non-admin callers via `user_roles` lookup.

## Verification (evidence-first, per your standing rule)

After you provide the prereqs and I implement A–D, you run these copy-pasteable steps on macOS with Xcode installed:

```
# 1. Pull latest
cd ~/your-clone-of-the-repo
git pull

# 2. Install JS deps
npm install

# 3. Build web bundle
npm run build

# 4. Sync into iOS Capacitor project
npx cap sync ios

# 5. Open in Xcode
npx cap open ios

# 6. In Xcode: Signing & Capabilities → + Capability → "Push Notifications"
# 7. In Xcode: Signing & Capabilities → + Capability → "Background Modes" → tick "Remote notifications"
# 8. Build & Run on a physical iPhone (push does NOT work on iOS Simulator)

# 9. In the running app: sign in as admin, accept the iOS notification prompt
# 10. In the Lovable sandbox terminal verify the token landed:
```

Then I'll run, against the project DB, immediately after step 9:

```sql
SELECT id, platform, length(token) AS token_len, created_at, last_seen_at
FROM device_tokens
WHERE user_id = 'e90213d4-7b8a-4ae7-a980-b0f212fac206'
ORDER BY created_at DESC;
```

Expected: at least one row with `platform='ios'`, `token_len ≈ 140–170` (FCM token, not raw 64-char APNs hex).

Then tap **Send test reminder** in the app. Edge logs must show:
```
[reminder-test] sent { code: "ok", deliveredNative: 1, fcmAttempts: 1, ... }
```
and your iPhone displays the push.

## Scope I will NOT do in this pass

- Android FCM enablement (still blocked on `google-services.json`).
- Web push bootstrap for browsers (separate VAPID flow).
- Logging test sends into `coaching_reminder_log`.

## What I need from you to start

Reply with the `GoogleService-Info.plist` file uploaded to chat, and confirm you've done the two Apple/Firebase console steps (APNs key in Firebase + Push capability in Apple Dev Portal). I'll then implement A–D in a single pass and walk you through the line-by-line Xcode steps.
