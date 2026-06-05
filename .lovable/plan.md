# Fix Sign in with Apple display name (Apple rejection)

Apple requires the name returned by Sign in with Apple on the **first** authorization to be captured and used as the user's display name — the app must not ask for/derive a name again.

## Current behavior

- `src/pages/Auth.tsx` calls native `SocialLogin.login({ provider: "apple", options: { scopes: ["email","name"], ... } })`. The plugin returns `apple.profile.givenName` / `apple.profile.familyName` on first authorization, but we **discard it**.
- We then call `supabase.auth.signInWithIdToken({ provider: "apple", token: idToken, nonce })`. The Supabase `handle_new_user` trigger inserts a `profiles` row using `raw_user_meta_data->>'display_name'` (absent for Apple) → falls back to `split_part(email,'@',1)`, producing the auto-generated `zrhnd7k97h` shown in the screenshot.
- Apple only returns the name on the **very first** authorization; subsequent sign-ins never include it, so we must persist it immediately.

## Changes

### 1. `src/pages/Auth.tsx` — capture Apple name and persist after sign-in

In the native Apple branch (after `signInWithIdToken` succeeds, before navigating):

- Build `fullName` from `apple.profile.givenName` + `apple.profile.familyName` (trimmed, single space, fallback to either one if only one is present).
- If `fullName` is non-empty:
  - `await supabase.auth.updateUser({ data: { display_name: fullName, full_name: fullName } })` so it lives on `raw_user_meta_data` (handy for any future trigger / re-creation).
  - Call a new helper `reconcileAppleDisplayName(userId, fullName)` (see #2) that updates `profiles.display_name` only when the current value is empty or looks auto-generated (matches `email local-part` or `^[a-z0-9]{6,12}$` random slug).
- Log via `logAuthDiag("oauth:apple-name-captured", { hasGiven, hasFamily, length })` and `"oauth:apple-name-skipped"` when Apple returned nothing (re-sign-in case).
- Never block the flow on a failure — if the profile update errors, log and continue (the name can be re-applied next time Apple returns it; we don't ask the user).

### 2. New helper: `src/lib/appleDisplayName.ts`

Exports:

- `extractAppleFullName(profile?: { givenName?: string|null; familyName?: string|null; name?: { firstName?: string|null; lastName?: string|null } | null }): string | null` — handles both shapes returned by the Capacitor social-login plugin.
- `reconcileAppleDisplayName(userId: string, fullName: string): Promise<void>` — mirrors the `reconcileLocalConsent` pattern in `AuthContext.tsx`:
  - Reads current `profiles.display_name`.
  - Considers it "replaceable" when null/empty, equals the email local-part, or matches a random-slug regex (`/^[a-z0-9]{6,16}$/i` and not containing a space).
  - Updates `profiles.display_name = fullName` only when replaceable.
  - Retries with the same `[500, 1500, 4000]` delays used for push-consent reconciliation, because `handle_new_user` inserts asynchronously.
- Also writes `localStorage["carnivore-apple-fullname-v1"] = fullName` as a safety net so a later runtime can still reconcile if the network update fails. `AuthContext` calls a one-time reconcile from this key on session bootstrap (parallel to `reconcileLocalConsent`).

### 3. `src/contexts/AuthContext.tsx` — opportunistic reconcile on session restore

- After the existing `reconcileLocalConsent` setTimeout block in `maybeReconcile`, schedule a second deferred call that reads the localStorage Apple name (if present) and calls `reconcileAppleDisplayName(user.id, name)`. On success, clear the localStorage key. This ensures a name captured on device A is never lost if the first reconcile attempt failed (e.g., offline).

### 4. Remove any "post-SIWA name" prompts

Search for and confirm there is no required name step blocking SIWA users. The current `src/pages/Profile.tsx` only shows display_name as inline-editable (optional) — no required input — so no UI changes are needed beyond #1–#3. The plan explicitly does **not** add any "please enter your name" prompt and does **not** ask the user to fill the name again on later sign-ins.

&nbsp;

User feedback: Approve the plan, but please revise the failure handling: do not assume Apple will return the name again later. Persist the Apple full name captured on first authorization as a high-priority operation, cache it locally before any network writes, retry reconciliation until success, and only clear the local cache after `profiles.display_name` has been confirmed updated.

&nbsp;

## Files touched

- `src/pages/Auth.tsx` — persist Apple name after `signInWithIdToken`.
- `src/lib/appleDisplayName.ts` — new helper (extract + reconcile + localStorage cache).
- `src/contexts/AuthContext.tsx` — on session bootstrap, attempt to reconcile any cached Apple name.

## Out of scope

- No DB migration (existing `profiles.display_name` column is sufficient).
- No changes to Google flow, email/password flow, or onboarding.
- No new UI.