# Fix: coaching call (Stripe) + subscriptions (RevenueCat) not triggering, bump to versionCode 9

## Current state (verified in code)

- Coaching call already routes through one shared path: every Android/web CTA calls `startCoachingStripeCheckout()` → `create-coaching-checkout` edge function → Stripe live price (USD `price_1TFm5RB…`, CAD `price_1TjmKy…`).
- Subscriptions already route through RevenueCat on native (iOS + Android) via `useNativePaywall()` → `purchasePackage()`, and only fall back to Stripe `create-checkout` on web.

So the intended architecture is in place. What is missing is any diagnostic signal: `create-coaching-checkout` has zero logging and returns generic 500 text, which the UI collapses into "Couldn't open checkout." The RevenueCat side logs offering shape but the purchase failure reason is not surfaced to the user. **The root cause of both failures is currently unconfirmed** — step 1 exists to make it visible rather than guess.

## Plan

### 1. Make the failures observable (no behaviour change)
- Add structured logging to `create-coaching-checkout`: user id, resolved country, price id, which secret name was used (name only, never the value), and on failure the Stripe error `type` / `code` / `message`.
- Return the real Stripe message in the error body and show it in the toast instead of the generic string (Coaching page, CoachingBooking sheet, Pricing/My Account).
- Add the same failure-reason surfacing for the RevenueCat purchase path so a declined/unavailable-product error is readable on device (`purchasePackage` result → toast text, plus a one-line console log for `adb logcat`).

### 2. Read the evidence and fix the actual cause
Once step 1 is deployed, one tap on each button gives the real error. Expected candidates, and the fix for each:
- Stripe price/key mismatch (price belongs to a different Stripe account than `STRIPE_SECRET_KEY`) → point the function at the correct price IDs for the live key in use.
- Missing/incorrect `STRIPE_SECRET_KEY` in this remixed project → set it.
- RevenueCat: Play Billing products unavailable because the APK is sideloaded rather than installed from a Play testing track, or the RC offering ↔ Play Console product mapping is incomplete → the log will name which, and I will report exactly what to change in the RC/Play dashboards.

No refactor of the payment routing: coaching stays Stripe, subscriptions stay RevenueCat on native.

### 3. Version bump
- `android/app/build.gradle`: `versionCode 9`, `versionName "1.1.2"`.

## Technical notes
- Files touched in step 1: `supabase/functions/create-coaching-checkout/index.ts`, `src/lib/coachingPurchase.ts`, `src/pages/Coaching.tsx`, `src/components/CoachingBooking.tsx`, `src/pages/Pricing.tsx`, `src/hooks/useNativePaywall.ts`, `android/app/build.gradle`.
- Secrets are never logged — only whether each name is present.
- After the changes: publish (so the deployed function has logging), then on your Mac `git pull origin main` and rebuild, and paste back the toast text plus `adb logcat | grep -E "RC |coaching"` output. I will use that evidence to complete step 2.
