## What the AAB proves

The uploaded working `6.aab` had this Android coaching payment flow:

1. User taps coaching payment.
2. App invokes `create-coaching-checkout`.
3. App opens Stripe Checkout for coaching calls and   RevenueCat/IAP Android for subscriptions.
4. Stripe returns to `/?coaching_payment=success`.
5. Home opens the coaching modal on the Cal.com screen.
6. User taps `Open Cal.com Scheduler`.
7. User taps `Done`, and the app inserts a `coaching_sessions` row client-side.

It did **not** contain these current-project additions:

- `record-coaching-purchase`
- `coaching-session-ios`
- iOS/no-payment booking URL routing
- `sessionSource` / already-paid routing
- client-side purchase recording before Cal.com

## Payment regressions to fix

### 1. Secret name mismatch

Current subscription/payment functions are split across two Stripe secret names:

- `create-checkout`, `check-subscription`, `customer-portal`, `_shared/requireTier` use `STRIPE_SECRET_KEY`
- `create-coaching-checkout` now uses `STRIPE_LIVE_SECRET_KEY`

The working AAB only proves the client called `create-coaching-checkout`; the current backend split means coaching can fail even if the normal subscription Stripe key is configured.

**Fix:** make `create-coaching-checkout` use the same Stripe secret convention as the rest of the payment backend: prefer `STRIPE_SECRET_KEY`, with fallback to `STRIPE_LIVE_SECRET_KEY` only if present.

### 2. Android coaching behavior drifted from the working AAB

Current Android/web coaching now shares code with newer iOS-specific purchase-recording logic in surrounding components. For Android, the safe target is the AAB behavior: Stripe checkout first, then Cal.com.

**Fix:** preserve Android as Stripe-only for coaching and keep `record-coaching-purchase` out of Android coaching checkout paths.

### 3. AAB success flow inserted a row after scheduling; current flow relies more on webhook/pending-row behavior

The working AAB inserted `coaching_sessions` from the client when the user tapped `Done`. Current code intentionally stopped that and expects Cal.com webhook behavior.

**Fix:** for Android/web success flow only, restore the AAB-compatible fallback insert on `Done` so a booked paid session is recorded even if webhook metadata/secrets are missing. Keep this scoped to the Stripe/Cal.com success path.

### 4. Current remixed project has no user Stripe/runtime payment secrets configured

The current project secret list only shows managed Lovable/backend secrets. No Stripe key is configured in this remixed backend.

**Fix:** after code alignment, request only the Android-relevant runtime secret(s): `STRIPE_SECRET_KEY` first. Do not request Apple keys.

## Implementation steps

1. Update `supabase/functions/create-coaching-checkout/index.ts`
  - Replace hard dependency on `STRIPE_LIVE_SECRET_KEY` with:
    - `STRIPE_SECRET_KEY || STRIPE_LIVE_SECRET_KEY`
  - Keep live/test validation minimal and non-breaking for the known-good flow.
  - Keep the existing checkout price ID and return URLs.
2. Update `src/components/CoachingBooking.tsx`
  - Restore AAB-compatible `Done` behavior for Stripe/Cal.com flow:
    - insert into `coaching_sessions`
    - `user_id = current user id`
    - `session_type = paid`
    - `session_month = current YYYY-MM`
  - Keep iOS purchase-recording behavior isolated so it does not affect Android.
3. Update `src/pages/Coaching.tsx` only if needed
  - Ensure Android continues to call `create-coaching-checkout` for coaching calls and   RevenueCat/IAP Android for subscriptions.
4. Add/check runtime secret
  - If `STRIPE_SECRET_KEY` is missing, open the secure secret form for `STRIPE_SECRET_KEY`.
  - Do not add Apple secrets for this Android-only project.
5. Verify
  - Confirm source references show Android coaching routes to `create-coaching-checkout`.
  - Confirm all Stripe backend functions can use the same configured secret.
  - Confirm no Apple secret requirement remains in the Android path.