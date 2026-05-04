# Release Blocker Fix Pass

## 1. Remove visible build stamp

**File**: `src/App.tsx`

- Remove the `<BuildStamp />` render (line 193) and the import (line 60). The stamp is the only visible build/version overlay.
- Keep `src/main.tsx`'s `[BuildInfo]` `console.info` for logcat debugging.
- Leave `src/components/BuildStamp.tsx` on disk (unused) so we can re-mount it temporarily for QA without re-creating the file.

## 2. Lock phones to portrait, leave tablets free

**File**: `android/app/src/main/AndroidManifest.xml`

- On the `MainActivity` element, do NOT add a static `android:screenOrientation`, because that would also lock tablets. Instead keep manifest as-is.

**File**: `android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java`

- In `onCreate`, before `super.onCreate`, detect tablet via `getResources().getConfiguration().smallestScreenWidthDp >= 600`.
- If NOT a tablet, call `setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT)` (allows portrait + reverse-portrait, blocks both landscapes). Tablets keep full sensor rotation.
- The existing `configChanges="orientation|screenSize|..."` already prevents activity recreation, so this is the safe, non-disruptive approach.

## 3. Fix onboarding being skipped on fresh state

Findings:

- Gate is correct: `Index.tsx` uses `isOnboardingComplete()` which reads `carnivore-onboarding-complete-v2 === "true"`.
- Two real holes:
  1. `src/pages/Onboarding.tsx` line 854 — the **"Skip for now" footer button** writes `STORAGE_KEY = "true"` on EVERY non-consent step. A single accidental tap (or a test build that auto-tapped through) marks onboarding complete with no answers, so the next launch goes straight to Home.
  2. `src/contexts/AuthContext.tsx` line 43 reads the flag with `=== "1"` (it's stored as `"true"`), so the diagnostic log was always misleading and masked the real state.

Fixes:

- `**src/pages/Onboarding.tsx**`: remove the "Skip for now" footer entirely (lines 848–864). Onboarding is mandatory per memory rule (`mem://features/onboarding/wellness-consent`), so this exit path should never have existed.
- `**src/pages/Onboarding.tsx**` `isOnboardingComplete`: harden to require both the flag AND the presence of a non-empty answers payload, so a stray `"true"` write without answers no longer counts:
  ```
  return localStorage.getItem(STORAGE_KEY) === "true"
      && !!localStorage.getItem("carnivore-onboarding-answers");
  ```
- `**src/contexts/AuthContext.tsx**`: fix the diagnostic to compare against `"true"` (cosmetic, but it prints the real state in logcat now).
- `**src/pages/Onboarding.test.ts**`: update the existing test to also write `carnivore-onboarding-answers` for the "true" case, and add one case asserting that a flag without answers returns `false`.

Wellness consent step (final consent screen at index 11) is untouched.

## 4. Notification: stop redundant prompts and crash

Root cause analysis:

- `usePushConsentFallback.ts` checks Supabase `profiles.push_consent` and local mirror, but **never asks the Android OS whether `POST_NOTIFICATIONS` is already granted**. A user who tapped "Allow" in the system dialog (e.g. during onboarding) but whose profile row is missing or stale (`unset`) re-sees the sheet, taps Enable → `PushNotifications.requestPermissions()` re-registers a listener and re-calls `register()`, which is the path that has been crashing.
- `requestNativePush` in `src/lib/pushFcm.ts` calls `PushNotifications.addListener(...)` every invocation → listener leak + duplicate token registrations on resume.

Fixes:

`**src/lib/pushFcm.ts**`

- Add module-scoped `listenersBound = false`. Bind `registration` / `registrationError` listeners exactly once (idempotent).
- Add exported helper `getNativePushPermission(): Promise<"granted"|"denied"|"prompt"|"unsupported">` that calls `PushNotifications.checkPermissions()` on native, returns `"unsupported"` on web. Wrap in try/catch so a plugin failure can never throw.
- In `requestNativePush`, call `checkPermissions()` first; if already `granted`, skip the request, ensure listeners bound, call `register()`, write `savePushConsent("granted")`, and return early. This makes repeated calls safe.
- Wrap the whole body in try/catch and `await savePushConsent("denied")` on throw, so a plugin crash can never propagate to React render.

`**src/hooks/usePushConsentFallback.ts**`

- At the very top of the timer callback (after `alreadyShown` check), call `getNativePushPermission()`. If `granted`, write `savePushConsent("granted")` (so the profile row catches up) and return — never open the sheet.
- Keep the existing profile/local consent checks as a second gate.
- This makes the "logged-in user with notifications already enabled" case truly silent.

`**src/components/NotificationConsentSheet.tsx**`

- In `handleEnable`, before calling `requestNativePush`, call `getNativePushPermission()`. If `granted`, just `savePushConsent("granted", prefs)`, toast success, close, no native call.
- Keep existing try/catch — this prevents the crash path from being entered redundantly.

## 5. Validation

- 375px portrait phone: BuildStamp gone; rotating device stays portrait; fresh-install onboarding shows; completing onboarding navigates to Home; subsequent launches do not re-prompt for notifications if previously granted; tablet (sw>=600dp) still rotates freely.
- Mobile-only changes; no changes to `BottomNav`, no layout shifts.

## 6. Files to modify

```
src/App.tsx
src/components/BuildStamp.tsx                 (untouched — left for QA)
android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java
src/pages/Onboarding.tsx
src/pages/Onboarding.test.ts
src/contexts/AuthContext.tsx
src/lib/pushFcm.ts
src/hooks/usePushConsentFallback.ts
src/components/NotificationConsentSheet.tsx
```

After merge: rebuild AAB via `scripts/build-android-fresh.sh`.

&nbsp;

**Two requirements while coding:**

1. **After removing “Skip for now,” verify every onboarding step still has a valid forward path and no dead-end state.**
2. **After implementing the notification fix, add lightweight logs around:**
  - **native notification permission state**
  - **whether the sheet was suppressed because OS permission was already granted**
  - **whether listeners were newly bound or already bound**
  &nbsp;

**When done, return:**

- **final modified file list**
- **any deviations from the plan**
- **exact commands I should run to rebuild and test on Android**