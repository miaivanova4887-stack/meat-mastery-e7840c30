# Anonymous-friendly push consent fallback

## Problem

`usePushConsentFallback` (in `src/hooks/usePushConsentFallback.ts`) currently bails out as soon as `supabase.auth.getUser()` returns no user (`reason=no-signed-in-user`). Since profile rows only exist after signup, anonymous users — who make up the entire pre-onboarding flow — never see the fallback sheet. The consent state lives only on `profiles.push_consent`, so there is also no place to record an anonymous user's choice for later reconciliation.

## Fix overview

Introduce a local-storage push-consent marker that mirrors `profiles.push_consent` for anonymous users. Update the fallback hook to use it when no auth user exists. After a user later signs in/up, reconcile the local marker into their profile (and treat the local onboarding-complete flag the same way).

The existing once-per-session sessionStorage guard, native-Android guard, and onboarding-triggered sheet are unchanged.

## Changes

### 1. New local push-consent helpers — `src/lib/pushConsentLocal.ts` (new)

Small module so all readers/writers stay consistent:

- Key: `carnivore-push-consent-v1` → `"unset" | "granted" | "denied"`
- Key: `carnivore-push-consent-at-v1` → ISO timestamp
- Exports: `getLocalPushConsent()`, `setLocalPushConsent(state)`, `clearLocalPushConsent()`.

### 2. `src/lib/pushFcm.ts` — record locally too

In `savePushConsent(state, preferences?)`:

- Always call `setLocalPushConsent(state)` first (works whether or not a user is signed in).
- Keep the existing `supabase.from("profiles").update(...)` path, but only run it when `getUser()` returns a user (already the case via the early `return`).
- Add `console.info("[Push] savePushConsent local=", state, "userPresent=", !!user)`.

This means both onboarding-triggered and shell-triggered sheets persist the choice locally, even for anonymous users.

### 3. `src/hooks/usePushConsentFallback.ts` — anonymous path

Replace the "no user → skip" branch:

- Keep mount log + native/platform/sessionStorage guards as-is.
- After the 600ms delay, call `supabase.auth.getUser()`:
  - **If user exists** (current path): read `profiles.push_consent`, fall back to `getLocalPushConsent()` if the row is missing. Decision uses whichever is "set" (non-`unset`).
  - **If no user** (new path): read `getLocalPushConsent()`. If `"unset"`, set the session flag and open the sheet. Log `console.info("[Push] anonymous fallback trigger fired source=", source)`. If already `granted`/`denied`, log skip with reason `consent-already-set-local`.
- Re-check the session flag right before `setOpen(true)` (already done) to keep multi-mount safety.

Add explicit logs for the new branches:

- `console.info("[Push] anonymous fallback check source=", source, "localConsent=", consent)`
- `console.info("[Push] anonymous fallback skipped reason=", reason, "source=", source)`

### 4. Reconcile on login/signup — `src/contexts/AuthContext.tsx`

In the `onAuthStateChange` handler, when `event === "SIGNED_IN"` (or session transitions from null → present), schedule a reconcile (microtask, so we don't block auth state):

- Read `getLocalPushConsent()`. If it is `"granted"` or `"denied"` AND the user's `profiles.push_consent` is still `"unset"`, update the profile row with the local value + `push_consent_at`. Log `[Push] reconciled local→profile consent=`.
- Read the local onboarding-complete flag (`carnivore-onboarding-complete-v2`, the existing key per memory). No DB write is needed today since onboarding completion is read from localStorage by `Index.tsx`; just log `[Onboarding] local flag carried into session present=` so we can confirm in logcat that the post-signup user keeps onboarding state.

We do **not** clear the local consent marker after reconcile — it stays as a cache so subsequent anonymous launches (e.g., signed-out reinstall edge cases) still behave correctly.

### 5. No changes to:

- `Onboarding.tsx` flow/steps, Health Connect prompts, push campaign code, `NotificationConsentSheet` UI, `App.tsx` shell host wiring.
- The `carnivore-onboarding-complete-v2` write site in `Onboarding.tsx` (already local, already anonymous-friendly).

## Verification (logcat)

Fresh install, no signup, open app → after splash:

```
[Push] fallback hook mounted source= shell
[Push] fallback check source= shell { native:true, platform:'android', alreadyShown:false }
[Push] anonymous fallback check source= shell localConsent= unset
[Push] anonymous fallback trigger fired source= shell
```

Tap "Not now" → log shows `savePushConsent local= denied userPresent= false`.

Later sign up → log shows `[Push] reconciled local→profile consent= denied`.

## Files

- new: `src/lib/pushConsentLocal.ts`
- edit: `src/lib/pushFcm.ts` (write local mirror in `savePushConsent`)
- edit: `src/hooks/usePushConsentFallback.ts` (anonymous branch + logs)
- edit: `src/contexts/AuthContext.tsx` (reconcile on `SIGNED_IN`)

**Add a safe retry in the auth reconcile step so if the profile row isn’t created yet at the exact moment of** `SIGNED_IN`**, the local consent is reconciled on the next profile load rather than being lost. Keep the local consent mirror, keep the session guard, and keep the anonymous fallback path**