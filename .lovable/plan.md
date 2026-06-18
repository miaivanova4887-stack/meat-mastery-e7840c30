# Fix: Coaching-Call Payment Environment Mismatch (Profile opens sandbox)

## Root Cause

There are **two different coaching-call checkout paths** wired to **two different Stripe price IDs through two different edge functions**. They are not the same flow.

```text
HOMEPAGE (correct / live)
  Index.tsx → MotivationCTA → CoachingBooking modal → handlePayment()
    → supabase.functions.invoke("create-coaching-checkout")
       → price_1TFm5RBCKK2x5xtVzSHn0acA      ← live coaching price

COACHING PAGE (correct / live)
  Coaching.tsx → handleBookPaid()
    → supabase.functions.invoke("create-coaching-checkout")
       → price_1TFm5RBCKK2x5xtVzSHn0acA      ← same live coaching price

PROFILE / MY ACCOUNT (wrong / sandbox)
  Profile.tsx (button → navigate("/pricing"))
    → Pricing.tsx → "Book a Call" → handleStripeCheckout(TIERS.coaching.priceId)
       → supabase.functions.invoke("create-checkout")
          → price_1TEtnMBqDvgi4jU7ozhwwm9i   ← DIFFERENT coaching price (sandbox/test)
```

So the divergence is **not the screen** — it is that the Profile/My Account route goes through the Pricing page, which creates the coaching checkout using a **separate price ID (`price_1TEtnMBqDvgi4jU7ozhwwm9i`) via the generic `create-checkout` function**, instead of the canonical `create-coaching-checkout` function + live price (`price_1TFm5RBCKK2x5xtVzSHn0acA`) used everywhere else. That stale coaching price is the one rendering sandbox checkout.

Confirmed shared/consistent (not the problem):
- Both `create-checkout` and `create-coaching-checkout` read the same `STRIPE_SECRET_KEY`.
- iOS native path (RevenueCat StoreKit) is intentional and correct; Android + web both use Stripe — also intentional per the working baseline.

## The Fix — standardize on one shared production coaching path

The homepage/Coaching path (`create-coaching-checkout` + `price_1TFm5RBCKK2x5xtVzSHn0acA`) is the source of truth. Every web/Android coaching-call entry point must use it.

### 1. `src/pages/Pricing.tsx`
- Change the web/Android coaching "Book a Call" button so it no longer calls `handleStripeCheckout(TIERS.coaching.priceId)`.
- Make it invoke `supabase.functions.invoke("create-coaching-checkout")` and open `data.url` via `openExternalUrl` — identical to `Coaching.tsx`/`CoachingBooking.tsx`.
- Remove `coaching` from the `TIERS` checkout config's price usage. Keep only the display amount (`$99.99`) for the label; delete `priceId: "price_1TEtnMBqDvgi4jU7ozhwwm9i"` so the stale test price is gone from the codebase.

### 2. `supabase/functions/create-checkout/index.ts`
- Remove the coaching one-off price (`price_1TEtnMBqDvgi4jU7ozhwwm9i`) from the allowed-price allowlist. `create-checkout` should only handle subscription prices (Pro/Elite). This guarantees the test coaching price can never be used for a session again.

### 3. (Optional hardening) Extract a shared helper
- Add `startCoachingStripeCheckout()` to `src/lib/coachingPurchase.ts` that wraps the `create-coaching-checkout` invoke + `openExternalUrl`, and have `Pricing.tsx`, `Coaching.tsx`, and `CoachingBooking.tsx` all call it. This makes "one shared production booking function" literal in code and prevents future drift.

## What is removed
- `price_1TEtnMBqDvgi4jU7ozhwwm9i` (the sandbox coaching price) — from `Pricing.tsx` `TIERS.coaching` and from the `create-checkout` allowlist.
- The Pricing coaching button's dependency on the generic `create-checkout` function.

## Validation checklist
1. Grep the repo: `price_1TEtnM` no longer appears anywhere; coaching checkout only references `price_1TFm5RBCKK2x5xtVzSHn0acA`.
2. Profile → "Manage plan"/tier card → /pricing → "Book a Call" now invokes `create-coaching-checkout` (verify via network panel: same function, same returned Stripe URL host/params as homepage).
3. Homepage MotivationCTA and Coaching page "Book & Pay" still invoke `create-coaching-checkout` (unchanged).
4. All three return a checkout URL from the **same** Stripe environment (live), confirmed by calling the edge function via the curl tool and inspecting `session.url`.
5. iOS native coaching purchase (RevenueCat) untouched and still routes to StoreKit, not Stripe.

## Items you must verify/set manually (Stripe + Lovable)
- Confirm `STRIPE_SECRET_KEY` in Lovable Cloud is your **live** secret key (`sk_live_...`). If it is a test key, the homepage is also test and the whole app needs the live key set — this is the one switch that ultimately controls live vs sandbox.
- Confirm `price_1TFm5RBCKK2x5xtVzSHn0acA` exists in **live** mode in your Stripe dashboard and is priced at $99.99. If the canonical coaching price should be a different live price ID, tell me and I'll point `create-coaching-checkout` at it.
- The Cal.com paid event (`https://cal.com/carnivorex/coaching-session`) must have its payment configured against the live Stripe connection, not a test connection.

## Technical notes
- No DB/schema changes. Frontend wiring + one edge-function allowlist edit only.
- No change to iOS StoreKit/RevenueCat behavior, the `handleDone` fallback insert, or `cal-webhook`.
