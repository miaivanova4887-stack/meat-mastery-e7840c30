# Activate CAD coaching price

You provided the LIVE CAD price ID: `price_1TjmKyBCKK2x5xtVbvfukFie`.

## Change (one line)
In `supabase/functions/create-coaching-checkout/index.ts`, set the currently-empty constant:

```text
const CAD_COACHING_PRICE_ID = "price_1TjmKyBCKK2x5xtVbvfukFie";
```

That's the only code edit. The region logic is already wired:
- `country === "CA"` → uses `CAD_COACHING_PRICE_ID` (now populated), else USD `price_1TFm5RBCKK2x5xtVzSHn0acA`.
- Client sends `country` hint; server re-validates via IP when no hint.
- `metadata.country` / `metadata.currency` are recorded on the session.

## Deploy + verify
1. Redeploy `create-coaching-checkout`.
2. Test the function with `{country:"CA"}` and confirm the returned Stripe session uses the CAD price / charges CAD 129.99.
3. Test `{country:"US"}` → USD 99.99.

## You must confirm manually (Stripe, Live mode)
- `price_1TjmKyBCKK2x5xtVbvfukFie` is on product `prod_UjEolHKfmoeJXD`, currency **CAD**, amount **12999**, **one-time**, and in **LIVE** mode (not test). If it's a test-mode price while `STRIPE_SECRET_KEY` is live, checkout will fail with "No such price".

Once verified, Canadian users are both shown and charged CAD 129.99; everyone else stays USD 99.99; iOS RevenueCat remains untouched.