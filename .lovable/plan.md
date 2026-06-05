## Root cause

iOS native FCM is wired (AppDelegate + SPM + GoogleService-Info.plist) but the **JS consent gate** that triggers `requestNativePush()` is still Android-only. Three call sites suppress on iOS:

1. `src/lib/pushDecision.ts` → `if (!native || platform !== "android") return not-android`
2. `src/hooks/usePushConsentFallback.ts` → same hard-coded Android check in the shell timer
3. `src/pages/Onboarding.tsx` step 11 → invokes audit but it returns `not-android`

Result: iOS users are never prompted → no APNs registration → no `fcm-token` event → no row in `device_tokens` → Send test reminder returns `no_devices` / `permission_denied`.

Logs prove it:

- `[PushDecision] source=shell branch=suppress reason=not-android native=true platform=ios`
- `[reminder-test] permission_denied { userId: e90213d4… }` (your account is `push_consent='denied'`)

## Fix

### A. JS — let iOS through the consent flow (shell only)

1. `**src/lib/pushDecision.ts**` — replace the `!== "android"` guard with a check that allows both `android` and `ios` when `isNativeFcmEnabled()` is true. Suppression reason for unsupported platforms stays `"not-android"` (rename to `"unsupported-platform"` for clarity, plus a back-compat alias kept in the union).
2. `**src/hooks/usePushConsentFallback.ts**` — same: allow `platform === "android" || platform === "ios"`. Keep the 90s delay. This is the auto-prompt path iOS users will hit ~90s after app start.
3. **Onboarding step 11 stays as-is** — per your choice ("shell auto-prompt only"), we do NOT trigger the audit on iOS at onboarding completion. Add an explicit `platform === "ios"` early-return in the step-11 push call (around the existing `[Onboarding] step11 done` log) so it logs `branch=skip reason=ios-shell-only` instead of running the audit.
4. No change to `pushFcm.ts` / `pushNativeConfig.ts` — `NATIVE_FCM_ENABLED_IOS=true` is already correct; `requestNativePush()` already handles iOS once it's actually called.

### B. Backend — reset your admin account's denied consent

Single `UPDATE` on `profiles` for the admin user `e90213d4-7b8a-4ae7-a980-b0f212fac206`:

- `push_consent = 'unset'`
- `push_consent_at = null`

This re-arms the audit so on the next iOS launch the consent sheet will open after 90s and `requestNativePush()` will call APNs → FCM token will arrive → `register-device-token` will insert into `device_tokens` (platform=`ios`).

(Local-storage mirror `push-consent` also needs to be cleared on-device; you'll do that by uninstalling+reinstalling the app, which we already do for every fresh build.)

### C. Memory update

Update `mem://constraints/native-fcm-disabled-until-google-services` to reflect: iOS gate is now open in JS too; Android stays disabled until `google-services.json` ships.

## Out of scope

- No edge-function changes (`coaching-reminder-test` is already correct; it just had nothing to send to).
- No Android FCM enable.
- No changes to admin gating (already correct).

## Verification (line-by-line, after build mode)

```bash
git pull
npm install
npm run build
npx cap sync ios
```

Then in Xcode: clean build folder, run on physical iPhone signed in as `mia.ivanova.4887@gmail.com` (admin).

Evidence to capture and paste back:

1. **Xcode console** within ~95s of launch should show, in order:
  - `[PushDecision] source=shell branch=mount`
  - `[PushDecision] source=shell branch=show-sheet reason=eligible`
  - System APNs prompt → tap Allow
  - `[Push] FCM token registered` (from AppDelegate) **or** `[Push] window:fcm-token received platform=ios len=…`
  - `[Push] device token persisted platform=ios len=…`
2. **DB check** (I'll run this for you after the build):
  ```sql
   SELECT platform, length(token), created_at
   FROM device_tokens WHERE user_id='e90213d4-7b8a-4ae7-a980-b0f212fac206'
   ORDER BY created_at DESC LIMIT 3;
  ```
   Expect at least one fresh `ios` row.
3. **Tap Send test reminder** in Profile → Coaching Reminder Settings.
  - Toast: "Sent (1 native, 0 web)".
  - Edge logs: `[reminder-test] sent { code: 'ok', deliveredNative: 1, ... }`.
  - Push banner appears on the iPhone.

If step 1 stalls at `show-sheet` without an FCM token, the cause will be one of: APNs key not uploaded to Firebase, `aps-environment` mismatch (dev vs prod build), or Push Notifications capability missing in Xcode — none of which are code-fixable from here.

User: Approved with two adjustments:

Proceed with the JS fix so iOS is allowed through the shell consent flow and no longer suppressed by Android-only checks.

Rename the active suppression reason from not-android to unsupported-platform so future logs are not misleading.

Also:

treat uninstall/reinstall as required for this admin test because iOS denied notification permission previously,

keep backend admin enforcement unchanged,

keep the frontend button hidden until admin status is positively resolved.

After shipping, I want proof logs showing:

[PushDecision] source=shell branch=show-sheet reason=eligible

APNs/FCM token registration

persisted ios token row

successful admin test reminder delivery