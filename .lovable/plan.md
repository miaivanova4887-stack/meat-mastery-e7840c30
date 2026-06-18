# Regional Coaching-Call Pricing (US / Canada)

Make the **web + Android Stripe** coaching-call flow charge and display the correct currency by region:

- **United States (and everyone else):** $99.99 USD
- **Canada:** $129.99 CAD

Region is decided by **IP geolocation**, with a **user override** so a traveler/VPN user can switch currency. **iOS RevenueCat/StoreKit coaching is completely untouched** — it keeps localizing via `paywall.packages.coaching.priceString`.

---

## Why "Play Store country" can't drive this

There is one app binary served to both the US and Canada Play listings. The Google Play account country is only readable through Google Play Billing (`BillingClient`). Coaching on Android uses **Stripe Checkout (a web redirect)**, which has no access to the Play Store account. So we use the best available proxy: **server-side IP geolocation**, with a manual override.

---

## Blocking manual step (Stripe dashboard) — do this first

The value you provided, `prod_UjEolHKfmoeJXD`, is a **product** ID, not a price ID. Stripe Checkout needs a **price** ID.

1. Open the coaching **Product** `prod_UjEolHKfmoeJXD` in Stripe (**Live** mode).
2. Add a new **Price**: currency **CAD**, amount **129.99** (i.e. `12999`), **One time**.
3. Copy the new **`price_...`** ID (starts with `price_`) and send it to me.
4. Confirm the existing USD price `price_1TFm5RBCKK2x5xtVzSHn0acA` is **USD / 9999** in Live mode.

Until I have the CAD `price_...` ID, the code will safely fall back to USD for everyone (no breakage), and flipping CAD on is a one-line change.

---

## Code changes

### 1. New region helper — `src/lib/coachingRegion.ts`
Single source of truth for region → currency → display amount.

```text
COACHING_PRICING = {
  US: { country: "US", currency: "USD", amount: 9999, display: "$99.99" },
  CA: { country: "CA", currency: "CAD", amount: 12999, display: "$129.99 CAD" },
}
DEFAULT = US
```
- `detectCoachingCountry()` — calls the new `detect-country` edge function (IP-based); falls back to `Intl.DateTimeFormat().resolvedOptions()` region (`en-CA` → CA) if the call fails. Returns `"US"` or `"CA"`.
- `getCoachingPricing(country)` — returns the display string + currency for UI.
- Stores any user override in `localStorage` (`coaching_region_override`) so the choice sticks.

### 2. New edge function — `supabase/functions/detect-country/index.ts`
- Reads the client IP from `x-forwarded-for`, looks up country via a lightweight geo API (e.g. `ipapi.co/<ip>/country/`), returns `{ country: "US" | "CA" | <iso> }`.
- CORS enabled; no auth required; defaults to `US` on any failure/timeout.

### 3. `supabase/functions/create-coaching-checkout/index.ts` (make region-aware)
- Parse an optional JSON body: `{ country?: string }`.
- Re-validate server-side: if no/blank `country`, detect from `x-forwarded-for` (same logic as `detect-country`) so the override is a hint, not blind trust.
- Select price: `country === "CA"` → CAD price ID, else USD price ID (`price_1TFm5RBCKK2x5xtVzSHn0acA`).
- Until the CAD `price_...` is provided, the CAD branch falls back to the USD price (guarded by a constant), so nothing breaks.
- Keep everything else (auth, customer lookup, timeout, success/cancel URLs, metadata) identical; add `currency`/`country` to `metadata` for reconciliation.

### 4. `src/lib/coachingPurchase.ts`
- `startCoachingStripeCheckout()` accepts `{ country?: string }` and passes it in the invoke `body`. All existing callers keep working (param optional).

### 5. UI — show region price + override (web/Android only; iOS branch unchanged)
On mount, each coaching surface resolves `country` via `detectCoachingCountry()` (respecting any saved override) and renders `getCoachingPricing(country).display`. A small **"Showing prices for: United States ▾ / Canada"** toggle lets the user switch; switching saves the override and updates the displayed amount. The selected country is passed into `startCoachingStripeCheckout({ country })`.

Files to update (replace hardcoded `$99.99` on the **non-iOS** branch only):
- `src/pages/Coaching.tsx` (line ~161 `: "$99.99"`).
- `src/components/CoachingBooking.tsx` (line ~357 fallback `"$99.99 per session"`), and pass `country` into the checkout call.
- `src/pages/Pricing.tsx` — replace static `TIERS.coaching.amount` usage (the bullet + "Book a Call" button label) with the region value, and pass `country` into `startCoachingStripeCheckout`.

---

## Explicitly untouched
- **iOS RevenueCat/StoreKit** coaching (`useIosIapForCoaching`, `paywall.packages.coaching.priceString`) — App Store handles its own US/CA pricing.
- Subscription pricing (Pro/Elite) and `create-checkout`.
- Cal.com scheduling flow and `record-coaching-purchase`.

---

## Verification
- Edge function: call `create-coaching-checkout` with `{country:"CA"}` and `{country:"US"}`, confirm the session uses the matching price/currency (after CAD price ID is added).
- `detect-country`: confirm it returns `US`/`CA` from a real request and defaults to `US` on failure.
- UI: confirm US shows `$99.99`, CA shows `$129.99 CAD`, override toggle switches both the label and the charged currency, and the iOS branch still reads StoreKit pricing.

---

## What I need from you to finish CAD
- The CAD **`price_...`** ID (from the manual Stripe step above). Everything else ships now and defaults to USD safely until that ID is in.
