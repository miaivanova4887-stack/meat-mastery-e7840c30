# Fix Stripe checkout (coaching call + subscriptions)

## What we know from the code and logs

- The coaching call CTA fails with the generic toast "Couldn't open checkout. Please try again." (your screenshot). `create-coaching-checkout` has **no logging at all**, and its edge-function logs show only boot lines — so the real Stripe error is currently invisible.
- The client throws away the server error: `startCoachingStripeCheckout` returns the message, but `CoachingBooking` catches and replaces it with the generic toast.
- Strong suspect: the price IDs in the two functions belong to **two different Stripe accounts**:
  - Subscriptions (`create-checkout`): `price_1TEtll**BqDvgi4jU7**...` (Pro/Elite)
  - Coaching (`create-coaching-checkout`): `price_1TFm5R**BCKK2x5xtV**...`, CAD `price_1TjmKy**BCKK2x5xtV**...`
  A single `STRIPE_SECRET_KEY` cannot resolve prices from both accounts, and a live key cannot resolve test-mode prices. `check-subscription` succeeded against Stripe ("No customer found"), so the key itself is valid — which points at price/account/mode mismatch rather than a bad key. This is a strong hypothesis, not yet confirmed; step 1 confirms it.

## Plan

1. **Make the failure visible (both functions)**
   - Add structured logging to `create-coaching-checkout`: key prefix only (`sk_live` / `sk_test`, never the value), resolved country, chosen price ID, and the full Stripe error (`type`, `code`, `message`) on failure.
   - Return the Stripe error message in the JSON body (already partly done) and surface it in the UI toast instead of the generic string, in `CoachingBooking`, `Coaching`, and `Pricing`.
   - Same logging treatment for `create-checkout` so the subscription path reports which price ID failed.

2. **Confirm the diagnosis**
   - Trigger both flows once from the app and read the new edge-function logs. Expected confirmation: `No such price: price_...` (or `a similar object exists in test mode`).

3. **Align key and prices**
   - Whichever account is correct, put its prices and its secret key on the same side: either update `STRIPE_SECRET_KEY` to the account that owns both product sets, or replace the price IDs so all five (Pro monthly/yearly, Elite monthly/yearly, coaching USD + CAD) come from the account the current key belongs to.
   - `create-coaching-checkout` also still falls back to the legacy `STRIPE_LIVE_SECRET_KEY`; once the correct key is in `STRIPE_SECRET_KEY`, drop that fallback so there is exactly one source of truth.

4. **Verify end to end**
   - Coaching: US and CA toggle each open a Stripe Checkout page with the right currency; success returns to `/?coaching_payment=success`.
   - Subscription: Pro and Elite, monthly and yearly, each open Checkout.
   - Re-check edge logs for clean runs.

## Technical notes

- Files touched: `supabase/functions/create-coaching-checkout/index.ts`, `supabase/functions/create-checkout/index.ts`, `src/components/CoachingBooking.tsx`, `src/pages/Coaching.tsx`, `src/pages/Pricing.tsx`.
- No schema changes, no changes to the iOS StoreKit path (iOS coaching stays on RevenueCat).
- Secret values are never logged; only the `sk_live` / `sk_test` prefix.

## What I need from you

- Which Stripe account is the live one for this app (the one whose dashboard shows the coaching product `prod_UjEolHKfmoeJXD`)? If the subscription prices live in a different account, I'll need the correct price IDs from the right account, or the right secret key entered via the secure secret form.
