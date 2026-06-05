## Audit findings

I inspected every IAP code path (RevenueCat init, subscription purchase, coaching consumable, restore, entitlement read, `record-coaching-purchase` edge function, `SubscriptionContext`). Summary:

**Already production-safe (no changes needed):**

- `src/lib/revenuecat.ts` — no sandbox/TestFlight branching. RC auto-detects sandbox vs production receipts; we use the same `appl_…` public key for both, which is correct.
- `src/contexts/SubscriptionContext.tsx` — calls `getEntitlements()` from RC on every auth change and every 60s, takes the higher of RC vs Stripe, and persists state. Subscription unlock + relaunch persistence + restore are wired correctly.
- `src/pages/Pricing.tsx` `handleNativeRestore` → calls `Purchases.restorePurchases()` then `refreshSubscription()`. Correct.
- `src/pages/Coaching.tsx` and `CoachingBooking.tsx` — Stripe path is correctly gated behind `!isRevenueCatAvailable()` so iOS never hits Stripe (Apple 3.1.1 compliant).
- `record-coaching-purchase` — idempotent on `(user_id, transaction_id)` via unique-violation handling. Service-role insert is correct.

**One real bug that hurts production reliability:**

- `src/pages/Pricing.tsx:144` and `src/pages/Coaching.tsx:~58` synthesize `transactionId = "rc_${user.id}_${Date.now()}"` instead of using the real Apple transaction id. The RC SDK actually returns it on `MakePurchaseResult.transaction.transactionIdentifier` (confirmed in `@revenuecat/purchases-typescript-internal-esm/dist/callbackTypes.d.ts`). Consequences:
  - A user double-tapping "Buy" while the network is slow can produce two rows (different timestamps) instead of one idempotent row.
  - A future RC server-side webhook (which carries the real Apple transaction id) cannot reconcile against rows we wrote with synthetic ids.
  - Refund/chargeback reconciliation is impossible without the real id.

**Not a code issue, but flagged for you:**

- App Store production IAP also requires: (a) the `coaching_call` product and both subscription products are in "Ready to Submit / Approved" state in App Store Connect, (b) the Paid Apps agreement is active, (c) the products are attached to the RC offering marked "Current" in the RC dashboard, and (d) Apple's App-Specific Shared Secret + App Store Connect API key are configured in RC. These are dashboard settings, not code.

## Changes I will make in build mode

### 1. `src/lib/revenuecat.ts` — return the real transaction id

Update `PurchaseResult` and `purchasePackage`:

```ts
export interface PurchaseResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  summary?: RcEntitlementSummary;
  transactionId?: string;          // NEW: real Apple/Google transaction id
  originalTransactionId?: string;  // NEW: iOS originalTransactionIdentifier
  productId?: string;              // NEW: real product id from store
  purchaseDateMs?: number;         // NEW: real purchase date
}
```

Inside `purchasePackage`, read `result.transaction.transactionIdentifier`, `result.transaction.productIdentifier`, and `result.transaction.purchaseDate` (and `originalTransactionIdentifier` when present on iOS) and surface them.

### 2. `src/pages/Pricing.tsx` and `src/pages/Coaching.tsx` — use real ids

Replace the synthetic id with the real one, falling back only if RC returned nothing:

```ts
const transactionId =
  result.transactionId ?? `rc_${user.id}_${Date.now()}`;
await recordCoachingPurchase({
  source: "appstore",
  productId: result.productId ?? info.pkg.product?.identifier ?? "coaching_call",
  transactionId,
  originalTransactionId: result.originalTransactionId,
  purchaseDateMs: result.purchaseDateMs ?? Date.now(),
});
```

(`CoachingBooking.tsx` gets the same treatment if it duplicates the call.)

### 3. `supabase/functions/record-coaching-purchase/index.ts` — persist originalTransactionId

It already accepts `originalTransactionId` in the `Body` type but ignores it. Add it to the insert so refund webhooks (and a future RC webhook) can join on it.

### 4. No other code changes

I will NOT add sandbox-detection branches, StoreKit Configuration file fallbacks, or environment-conditional product ids. The current code is already environment-agnostic and that is the correct posture.

## What I can validate from code; what only you can validate on-device

I can confirm (and will after the edits): types compile, no sandbox-only branches exist, the same purchase code path runs in Sandbox/TestFlight/Production, RC is configured once with the production-shape public key.

I **cannot** run on-device IAP tests from here. The checklist you listed (buy subscription → relaunch → restore; buy coaching → reach booking → relaunch) has to be run by you against:

1. A Sandbox Apple ID in a debug build,
2. A TestFlight build (which runs in Apple's sandbox automatically),
3. A real App Store build after release.

After the code edits, I will hand back a step-by-step terminal + device checklist you can execute (clean build, install, run each scenario, what to look for in `Purchases.getCustomerInfo` logs and in the `coaching_sessions` table).

User: **lan approved with one adjustment:**

- **The synthetic transaction ID issue is a real bug and should be fixed.**
- **Please surface and persist the real Apple transaction ID and** `originalTransactionId` **when the installed RevenueCat runtime actually provides them.**
- **Before relying on those fields, verify they exist in our exact SDK/runtime purchase result, not just in typings.**
- **Keep the current environment-agnostic purchase flow; do not add sandbox/production branching.**
- **Keep the fallback synthetic ID only as a last resort if RevenueCat does not expose a stable real transaction ID at runtime.**
- **Also update the backend insert to persist** `originalTransactionId`**.**

**Separate from code, I will verify App Store Connect / RevenueCat dashboard requirements: products active, offering current, Paid Apps agreement, and required Apple credentials in RevenueCat.**

## Out of scope

- Adding a RevenueCat → Supabase webhook (separate feature; would let us drop the client-side `recordCoachingPurchase` entirely).
- Changing RC dashboard offerings/entitlements/products (you own that).
- Apple sandbox testers, Paid Apps agreement, or shared-secret config in RC.