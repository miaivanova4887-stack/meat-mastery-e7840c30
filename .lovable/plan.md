## What I will fix

The screenshots are valid evidence: iOS has not recorded a notification authorization request, so this is earlier than token registration.

I will change the flow so the app must call the native iOS permission request when OS permission is still undetermined, then call registration only after a granted result.

## Plan

1. **Fix the iOS shell consent path**
  - Keep the shell-only timing for iOS.
  - Make the shell audit explicitly log iOS eligibility and OS permission state.
  - Ensure the shell sheet does not merely update local/profile state without invoking the native permission request.
2. **Fix the admin reminder path**
  - In the admin “Send test reminder” flow, before calling the test reminder backend, check native iOS notification permission.
  - If iOS permission is `prompt` / undetermined, call `requestNativePush()` from the admin action.
  - Only continue to send the test reminder if OS permission is granted and registration has run.
  - This prevents the admin path from depending only on the in-app toggle or existing local consent.
3. **Add exact native permission logs**
  - Add these JS logs around the Capacitor plugin calls:
    - `[Push] requestPermissions called`
    - `[Push] requestPermissions result receive=...`
    - `[Push] register called`
    - `[Push] registration success ...`
    - `[Push] registrationError ...`
  - Preserve the existing Swift logs for APNs/FCM:
    - `[Push] iOS APNs token registered len=...`
    - `[Push] iOS registrationError: ...`
    - `[Push] FCM token registered len=...`
4. **Make registration order explicit**
  - `PushNotifications.requestPermissions()` runs first when permission is not already granted.
  - `PushNotifications.register()` runs only after `receive === "granted"`.
  - Existing granted permission can still proceed directly to registration.
5. **Reset admin consent again**
  - Reset the admin profile push consent to `unset` again so the next shipped build can re-trigger the iOS permission path cleanly.

## Files to change

- `src/lib/pushFcm.ts`
- `src/components/CoachingReminderSettings.tsx`
- Possibly `src/lib/pushDecision.ts` / `src/hooks/usePushConsentFallback.ts` only if inspection shows another iOS suppression remains.

## Verification I will provide after implementation

Because I cannot physically press the iOS system permission dialog from here, I will add deterministic logs that you can capture in Xcode. The expected log sequence for the iPhone admin account will be:

```text
[PushDecision] source=shell branch=mount ... platform=ios
[PushDecision] source=shell branch=show-sheet reason=eligible
[Push] requestPermissions called platform=ios existing=prompt
[Push] requestPermissions result receive=granted|denied
[Push] register called platform=ios reason=fresh-grant
[Push] registration success platform=ios valueLen=...
[Push] iOS APNs-token registration event len=...
[Push] window:fcm-token received platform=ios len=...
[Push] device token persisted platform=ios len=...
```

If `receive=denied`, iOS should then show the Notifications section in Settings with disabled notification controls. If `receive=granted`, it should show enabled notification controls and registration should proceed.

User: Approved with one implementation adjustment:

Keep the added iOS permission and registration logs exactly as proposed.

Keep the admin test flow bootstrap when OS permission is undetermined.

But on iOS, please do not over-couple APNs registration to only the granted branch. I want the implementation reviewed so the app still performs the proper native remote notification registration flow needed for iOS system recognition, while UI messaging still respects granted vs denied.

I need the resulting logs to show clearly:

whether requestPermissions() was called,

what it returned,

whether native registration was attempted,

whether APNs/FCM registration succeeded or failed.

&nbsp;