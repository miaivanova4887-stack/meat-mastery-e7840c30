# AI Recipe Coach: Pro members on the app store are blocked

## What I found

The AI Recipe Coach does not work for Pro members who subscribed inside the Android (or iOS) app.

- In the app, the Coach screen unlocks correctly, because the app trusts the app-store subscription (RevenueCat).
- But the server check behind the Coach only looks up subscriptions in Stripe (web payments). An app-store Pro member has no Stripe subscription, so the server answers "upgrade required" and the user sees "AI Coach requires a Pro or Elite subscription."

So: Pro bought on the web works. Pro bought in the app is unlocked visually but fails the moment a message is sent.

The same server check guards three other paid features, so they are affected in exactly the same way:
- AI meal plan generation
- Food photo recognition
- Meal image generation

## The fix

Teach the server check to accept app-store subscriptions as well as Stripe:

1. Look up the signed-in user's entitlements with RevenueCat directly from the server.
2. Grant the higher of the two results (app store vs Stripe), matching what the app already does on screen.
3. If the RevenueCat lookup fails for technical reasons, fall back to the Stripe answer instead of locking a paying member out.
4. Keep the short-lived cache so we don't add a lookup on every message.

Because all four features share this one check, fixing it once repairs the Coach, meal plans, photo recognition, and meal images together.

## What I need from you

A **RevenueCat secret API key** (RevenueCat dashboard → Project settings → API keys → the secret/V2 key, not the public SDK key). Without it the server cannot ask RevenueCat who is subscribed. I'll request it securely when we start building.

## After the change

I'll verify by calling the Coach endpoint with a Pro app-store account's session and confirming it streams a reply instead of returning "upgrade required", and check the server logs show the tier resolved from RevenueCat.

## Technical detail

- `supabase/functions/_shared/requireTier.ts` resolves tier only via `stripe.customers.list` + `subscriptions.list` against `PRO_PRODUCTS` / `ELITE_PRODUCTS`; there is no RevenueCat path and no persisted entitlement table.
- `src/contexts/SubscriptionContext.tsx` takes `max(rcRank, stripeRank)` client-side — the mismatch with the server gate is the bug.
- Add an RC REST lookup (`GET https://api.revenuecat.com/v2/projects/{project_id}/customers/{app_user_id}` or v1 `/subscribers/{app_user_id}` with `Authorization: Bearer <secret key>`) keyed by `user.id` (RC `identifyUser(user.id)` is already called), map active entitlements to `pro`/`elite`, and take the higher rank; cache the merged tier in the existing 60s `tierCache`.
- Consumers of the gate: `recipe-coach`, `meal-plan-ai`, `recognize-food`, `generate-meal-image`, `create-coaching-checkout` (last one is web/Stripe-only, unchanged behaviour).
- Secrets needed: `REVENUECAT_SECRET_API_KEY` (+ `REVENUECAT_PROJECT_ID` if the v2 endpoint is used).
