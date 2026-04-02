

## Switch Coaching Checkout to Live Stripe Key

### What changes

**One file only:** `supabase/functions/create-coaching-checkout/index.ts`

1. Change Stripe initialization from `STRIPE_SECRET_KEY` to `STRIPE_LIVE_SECRET_KEY`
2. Add a defensive guard that throws if the resolved key starts with `sk_test_` (prevents accidental test-mode usage in production)
3. Price ID `price_1TFm5RBCKK2x5xtVzSHn0acA` stays as-is (confirmed live)

### What does NOT change
- Frontend (`CoachingBooking.tsx`, `Index.tsx`) — no Stripe publishable key is used client-side; the flow calls `supabase.functions.invoke()` and receives a URL. No changes needed.
- `create-checkout` (subscription flow) and `check-subscription` — out of scope per request.
- Success/cancel URLs remain `/?coaching_payment=success|cancelled` — these are relative to origin and work in any mode.
- No webhooks exist for this flow — nothing to update.

### Edge function diff (line 27)

```typescript
// Before
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {

// After
const liveKey = Deno.env.get("STRIPE_LIVE_SECRET_KEY") || "";
if (!liveKey || liveKey.startsWith("sk_test_")) {
  throw new Error("Live Stripe key is missing or a test key was provided");
}
const stripe = new Stripe(liveKey, {
```

### Env vars required
- `STRIPE_LIVE_SECRET_KEY` — already present in secrets (confirmed from project config)

### Change report
| Item | Status |
|------|--------|
| Files changed | `supabase/functions/create-coaching-checkout/index.ts` |
| Env vars required | `STRIPE_LIVE_SECRET_KEY` (already set) |
| Live Stripe IDs needed | None — price ID confirmed live |
| Manual verification | Make a real CA$99 test purchase to confirm Stripe processes in live mode; verify the checkout page shows your live business name (not "Test mode" banner) |

