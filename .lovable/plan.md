## Goal

Decouple the push opt-in fallback from onboarding completion so users who skip onboarding still see the consent sheet exactly once, gated only by `profiles.push_consent === 'unset'` and a signed-in profile.

## Problem

In `src/pages/Index.tsx`, the fallback effect runs only on Home, but Home immediately `<Navigate to="/onboarding" />` if onboarding is incomplete. Skipped/incomplete onboarding users never see the fallback. Profile has no fallback at all.

## Changes

### 1. Lift the fallback into a small shared hook
Create `src/hooks/usePushConsentFallback.ts`:
- Native Android only.
- Waits for an authenticated session via `supabase.auth.getUser()`.
- Reads `profiles.push_consent`; if `'unset'`, sets `sessionStorage["push-prompt-shown"] = "1"` and returns `{ open, onClose }` for the sheet.
- Guards: runs at most once per browser session; aborts if already shown, already responded, or component unmounts.
- Logs `console.info("[Push] fallback trigger fired source=", source, "consent=", consent)` when it decides to open. Accepts a `source` arg (`"home" | "profile"`) for traceability.
- Does not race onboarding: only fires after the profile fetch resolves with a real row (signed-in profile loaded). Uses a 600ms initial delay to let onboarding-triggered sheet take precedence on the same launch.

### 2. Wire the hook on Home and Profile
- `src/pages/Index.tsx`: replace the inline effect with `usePushConsentFallback("home")`. Keep the `<NotificationConsentSheet>` mount. Important: the existing early `Navigate` to `/onboarding` means Home only shows for completed users — that's fine, the Profile mount covers the skipped case.
- `src/pages/Profile.tsx`: import the hook and `NotificationConsentSheet`, call `usePushConsentFallback("profile")`, and mount the sheet. Profile is reachable from BottomNav even when onboarding is incomplete (verify by quick check of router/onboarding-skip path; if Profile is also gated, gate fallback on the auth screen instead — but typical flow shows Profile is accessible).

### 3. Session-once + responded guarantees
- `sessionStorage["push-prompt-shown"]` set the moment we open the sheet (prevents the other page from re-opening it in the same session).
- On `onClose` from the sheet, do NOT clear the flag — `savePushConsent` inside the sheet flips `push_consent` to `granted`/`denied`, so the consent check itself prevents re-prompting on future sessions.

### 4. Logging
- `console.info("[Push] fallback check source=...")` on each mount entry.
- `console.info("[Push] fallback skipped reason=...", { native, alreadyShown, consent })` on each early-exit.
- `console.info("[Push] fallback trigger fired source=...", consent)` when sheet opens.

## Out of scope
- No changes to onboarding flow, Health Connect logic, campaign/scheduler logic, or the sheet's internal behavior.
- No changes to web push.

## Files
- new: `src/hooks/usePushConsentFallback.ts`
- edit: `src/pages/Index.tsx` (replace inline effect with hook)
- edit: `src/pages/Profile.tsx` (add hook + sheet mount)
