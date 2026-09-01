# Validate coaching Stripe checkout + in-app subscriptions

## What I confirmed from this project (reads only)

Coaching call (Stripe, web + Android):

- `create-coaching-checkout` is deployed and correct in code: auth check, customer lookup by email, region detection (client hint `US`/`CA`, otherwise IP lookup), `mode: "payment"`, 8s timeout, success/cancel URLs, metadata (`userId`, `type: coaching_session`, country, currency), and full `[COACHING-CHECKOUT]` logging.
- Price IDs hardcoded: USD `price_1TFm5RBCKK2x5xtVzSHn0acA`, CAD `price_1TjmKyBCKK2x5xtVbvfukFie`.
- All non-iOS CTAs go through the single helper `startCoachingStripeCheckout`, which surfaces the real Stripe error body in the toast.

Secrets actually configured in this (remixed) backend: `GOOGLE_OAUTH_CLIENT_ID`, `LOVABLE_API_KEY`, `STRIPE_SECRET_KEY`. That's it.

So, two concrete gaps:

1. `STRIPE_SECRET_KEY` exists, but its value is write-only — I cannot tell whether it is the **live** key from the original project or a test key, and I cannot tell whether the two hardcoded price IDs exist in that account/mode. If the key and the prices are from different accounts or modes, checkout fails with `resource_missing` on `line_items[0][price]`. This is the single most likely cause of a failed payment and must be proven before submitting.
2. `CAL_WEBHOOK_SECRET` is **not set** in this project. `cal-webhook` reads it, so the post-payment Cal.com booking confirmation path will reject/misbehave even when the Stripe charge succeeds. set [https://gueosugzlebbaijzcxgh.supabase.co/functions/v1/cal-webhook](https://gueosugzlebbaijzcxgh.supabase.co/functions/v1/cal-webhook)

Subscriptions (RevenueCat, native):

- Android SDK key `goog_LJgdLQzxkXUPLaORSMbZNpIPLMW`, iOS `appl_gynfZqPKaFVIhSVZFDUUghawXno`, entitlements `pro` / `elite`, coaching consumable `coaching_call` (iOS only).
- Purchase path, package resolution (`pro_monthly`, `elite_monthly`, etc.), `[RC PURCHASE]` logging and a visible retry card when products fail to load are all in place.
- What cannot be validated from code: whether Google Play Console has the subscription products **active**, whether they are attached to the RC entitlements, and whether the app is uploaded to a Play track. Play Billing returns empty offerings for an app not yet distributed on a track, which looks exactly like "in-app payment doesn't trigger".

## Plan

Step 1 — prove the Stripe key mode and price validity (server-side, no guessing)
Add a temporary admin-only edge function `stripe-config-check` that:

- requires an authenticated admin (`has_role(auth.uid(),'admin')`),
- reports the key mode (`live` / `test`) derived from the key prefix, never the key,
- retrieves both price IDs and returns for each: exists, active, currency, unit amount, product id,
- returns the Stripe account id / business name so the account can be matched to the right dashboard.
Run it once; if it reports test mode or a missing price, update `STRIPE_SECRET_KEY` to the live key from the original project's Stripe dashboard and/or correct the price IDs, then re-run until both prices resolve as active LIVE prices in the correct currencies.

Step 2 — set the missing Cal.com webhook secret
Following [Cal.com's webhook guide](https://cal.com/docs/developing/guides/automation/webhooks#2021-10-20) (secret set on the webhook, signature sent as `X-Cal-Signature-256` = HMAC-SHA256 of the raw body), use [https://gueosugzlebbaijzcxgh.supabase.co/functions/v1/cal-webhook](https://gueosugzlebbaijzcxgh.supabase.co/functions/v1/cal-webhook) `CAL_WEBHOOK_SECRET` via the secure form, using the same value configured on the Cal.com webhook, and re-point the Cal.com webhook URL at this project's `cal-webhook` function.

Step 3 — end-to-end coaching payment test
With the app signed in on Android, tap Book a Call, capture the checkout URL mode (`checkout.stripe.com` live session vs test), complete a real charge, and confirm: `coaching_sessions` row created, Cal.com booking recorded, success redirect handled.

Step 4 — verify the subscription products with a real device readout
Collect the `[RC PURCHASE]` / offering logs from the device (`packageCount`, package identifiers, `readableErrorCode`) and compare them against the RC dashboard offering. Then, based on that readout, fix whichever is wrong: RC package identifiers vs Play product ids, entitlement attachment, or missing Play track upload. No code change should be made before that readout, because the client code path is already correct.

Step 5 — remove the temporary `stripe-config-check` function once both flows pass.

## Technical notes

- No product/pricing logic changes are proposed; the checkout and RC code paths verify as correct.
- The verification function returns only booleans, currency, amount and ids — never secret values.
- `record-coaching-purchase`, `check-subscription`, `create-checkout` need only `STRIPE_SECRET_KEY` plus platform-provided Supabase vars, so no further secrets are required for payments.