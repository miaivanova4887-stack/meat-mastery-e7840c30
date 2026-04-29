## Root cause

`src/pages/Index.tsx` runs `if (!onbComplete) return <Navigate to="/onboarding" replace />;` on **line 101-103**. Any user whose `carnivore-onboarding-complete-v2` flag is missing — including users who haven't completed onboarding yet — is bounced to `/onboarding` before `usePushConsentFallback("home")` mounts. Profile is reachable via `BottomNav` (no gate), but if the user never taps the Profile tab the hook never gets a chance to run there either. Net effect: the fallback never fires for anyone whose onboarding is incomplete.

The skip path is fine — there is no "skip whole flow" button; reaching Step 11 (Wellness consent) writes `STORAGE_KEY = "carnivore-onboarding-complete-v2"` (Onboarding.tsx line 317). So the only fix needed is to make the fallback mount independent of route.

## Fix

### 1. New always-mounted shell component

Create `src/components/PushConsentFallbackHost.tsx`:

- Mounts once inside `<BrowserRouter>` at the App level (alongside `BackButtonHandler`, etc.), so it runs on every route including `/onboarding`, `/auth`, `/recipes`, etc.
- Calls `usePushConsentFallback("shell")` and renders `<NotificationConsentSheet open={...} onClose={...} />`.
- Returns `null` apart from the sheet portal.

### 2. Wire it in `src/App.tsx`

Add `<PushConsentFallbackHost />` next to the other handler components inside `<BrowserRouter>`. It sits inside `<AuthProvider>` / `<UserProfileProvider>` which already wrap `<BrowserRouter>`, so `supabase.auth.getUser()` works.

### 3. Remove the now-redundant per-page hook calls

- `src/pages/Index.tsx`: remove `usePushConsentFallback("home")` call, the `pushFallback` variable, and the `<NotificationConsentSheet open={pushFallback.open} ... />` mount. Keep the import-free file.
- `src/pages/Profile.tsx`: remove `usePushConsentFallback("profile")` call and its sheet mount (if present). Leave the manual-trigger sheet (the one tied to a settings button) alone if it exists separately.

This guarantees the fallback runs exactly once per session from a single source, with no double-mounts racing each other.

### 4. Update the hook itself

`src/hooks/usePushConsentFallback.ts`:

- Add an immediate mount log **before any guards or async work**:
  ```ts
  console.info("[Push] fallback hook mounted source=", source);
  ```
- Widen the `PushFallbackSource` type to include `"shell"`.
- Keep the existing 600ms delay, native-Android guard, session flag, and `consent === 'unset'` check unchanged.
- Keep all existing `console.info("[Push] ...")` logs.

### 5. Race protection with onboarding-triggered sheet

The onboarding flow opens its own `NotificationConsentSheet` on Step 11 completion. To prevent the shell fallback from also opening on the same launch:

- The onboarding flow's push sheet open path should set `sessionStorage["push-prompt-shown"] = "1"` at the moment it opens (one-line addition in `src/pages/Onboarding.tsx` where `setShowPushConsent(true)` is called, and likewise after the HC prompt path opens it). The hook already re-checks the session flag immediately before opening, so this fully prevents a double-prompt within the same launch.

### Out of scope

- No changes to onboarding step logic, Health Connect prompt, push scheduler, or campaign code.
- No changes to `NotificationConsentSheet` internals.
- No changes to auth or routing gates.

## Files

- new: `src/components/PushConsentFallbackHost.tsx`
- edit: `src/App.tsx` (mount the host inside `<BrowserRouter>`)
- edit: `src/hooks/usePushConsentFallback.ts` (immediate mount log, add `"shell"` to source type)
- edit: `src/pages/Index.tsx` (remove hook call + sheet mount)
- edit: `src/pages/Profile.tsx` (remove fallback hook call + its sheet mount)
- edit: `src/pages/Onboarding.tsx` (set `push-prompt-shown` session flag when onboarding-driven sheet opens, to prevent same-launch double-prompt)

## Verification

After install + skip-through-onboarding (or even before reaching Step 11), `adb logcat | grep "\[Push\]"` should show:

```
[Push] fallback hook mounted source= shell
[Push] fallback check source= shell ...
[Push] fallback trigger fired source= shell consent= unset
```

on first eligible native launch, regardless of which route is active.

&nbsp;

make the shell host the **primary** fallback and keep page-level hooks only if they’re harmless. That gives you one reliable place that always runs, while preserving the existing flow