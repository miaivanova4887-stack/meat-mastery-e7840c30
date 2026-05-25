# Fix: AI Recipe Coach blocked for Pro/Elite users

## Root cause

`src/pages/RecipeCoach.tsx` calls the `recipe-coach` edge function with the Supabase **anon publishable key** in the `Authorization` header instead of the signed-in user's **session JWT**.

The edge function's `requireTier` helper validates that header via `supabase.auth.getUser(token)`. The anon key is not a user JWT, so `getUser` returns no user and the function responds **401 `unauthorized**` — regardless of the caller's actual Stripe/RevenueCat tier. The client-side `hasAccess("pro")` gate passes (Elite confirmed in `check-subscription` logs), so the UI lets the user type, but every send fails.

The entitlement mapping itself is correct:

- `SubscriptionContext` → `check-subscription` edge function → maps `prod_UDKR86KzvAtCwC` / `prod_UDKRxb2dW2O5Fv` to `elite` and `prod_UDKQuuDbkzFeAQ` / `prod_UDKRnuNBZAt90m` to `pro`. Same product IDs are also used in `requireTier`. RevenueCat path (`pro` / `elite` entitlements) is fine for native.
- The RC product IDs the user listed (`pro_monthly_1`, `pro_yearly_1`, `elite_monthly`, `elite_yearly`) are package/product identifiers; gating is done on RC **entitlements** (`pro`, `elite`), which is the correct pattern.
- RC products should be : pro_yearly:yearly, pro_yearly:yearly, elite_yearly:yearly, elite_monthly:monthly

So no changes are needed in `SubscriptionContext.tsx`, `revenuecat.ts`, `TeaserGate`, or `requireTier.ts`.

## Changes

### 1. `src/pages/RecipeCoach.tsx`

- Import `supabase` from `@/integrations/supabase/client`.
- In `sendMessage`, fetch the current session and use its `access_token` for the `Authorization` header. If there is no session, show a toast and bail.
- Switch from the raw `fetch(CHAT_URL, …)` to keep streaming (we still need the raw `Response.body` reader, so we keep `fetch` — just swap the bearer token).
- On non-OK responses, surface a `useToast` toast with a clear message:
  - `401` → "Please sign in again to use the AI Coach."
  - `403` (`upgrade_required`) → "AI Coach requires a Pro or Elite subscription." (shouldn't happen for paid users but covers edge cases like an expired sub the client hasn't refreshed yet, and we also call `refreshSubscription()`).
  - `402` / `429` → pass through the server message.
  - other → show the server-provided `error` field if present.
- Keep the inline assistant-bubble fallback message but make it more accurate (currently says "Sorry, something went wrong" — we'll include the status reason).

### 2. No backend changes

`recipe-coach` and `requireTier` are correct. Once the client sends the real JWT, Pro/Elite users will pass the tier check.

## Verification

1. Open the Preview as the logged-in Elite user (`mia.ivanova.4887@gmail.com`, confirmed Elite in the latest `check-subscription` logs).
2. Navigate to Recipe Coach, tap a starter prompt.
3. Confirm a streamed response arrives (no 401, no error toast).
4. Check `recipe-coach` edge function logs: should show a successful `requireTier` pass and a 200 stream.
5. Sign out → page shows the existing TeaserGate; composer stays disabled (unchanged).

## Files touched

- `src/pages/RecipeCoach.tsx` (only file changed)