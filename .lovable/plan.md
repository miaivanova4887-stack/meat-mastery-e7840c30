# Convert "Book a Call" coaching to StoreKit consumable IAP on iOS

Apple Guideline 3.1.1 requires digital services sold inside the iOS app to use IAP. The app already integrates RevenueCat for the Pro/Elite subscriptions; we'll add the coaching one-off as a **consumable** managed through the same RC SDK (which wraps StoreKit) and platform-gate the Stripe path so it stays web-only.

## App Store Connect — product to create (you)

In App Store Connect → My Apps → Carnivore Coach Pro → **In-App Purchases** → "+":

- Type: **Consumable**
- Reference Name: `Coaching Call`
- Product ID: `**com.mi4labs.carnivorex.coaching_call**` (must match the constant we'll add in code)
- Price tier: equivalent to USD $99.99 (Apple Tier 100)
- Display Name (EN): `1-Hour Coaching Call`
- Description: short copy describing the 1-on-1 session
- Review Screenshot: any in-app screenshot of the Coaching screen

In **RevenueCat dashboard** → Products → Add:

- Identifier: `com.mi4labs.carnivorex.coaching_call`, store: App Store, type: Consumable
- Attach it to the **current Offering** as a package with identifier `coaching_call` (no entitlement — consumables don't grant entitlements).

## Code changes

### 1. `src/lib/revenuecat.ts`

- Add `export const COACHING_PRODUCT_ID = "com.mi4labs.carnivorex.coaching_call"` and `export const COACHING_PACKAGE_ID = "coaching_call"`.
- Add helper `findCoachingPackage(offering): PurchasesPackage | null` that matches by package identifier first, then by `product.identifier === COACHING_PRODUCT_ID` as fallback.
- Keep `purchasePackage(pkg)` reusable for the consumable — RC handles consumables through the same call; no API change needed.

### 2. `src/hooks/useNativePaywall.ts`

- Resolve a new `coaching` package alongside the existing 4 subscription packages and expose `packages.coaching?: NativePackageInfo` (priceLabel formatted as `priceString` only, no `/mo` suffix).

### 3. `src/pages/Pricing.tsx` (Book a Call button, lines 467–478)

- On native (`paywall.enabled`):
  - If `paywall.packages.coaching` is present → button label uses `priceLabel`, `onClick` calls a new `handleNativeCoachingPurchase` that calls `paywall.purchase(coachingPkg)`, then on success awaits `recordCoachingPurchase(...)` (see step 5), then routes to the existing Cal.com scheduler screen via `CoachingBooking` opened on `calcom` screen, and toasts success.
  - If the package isn't loaded yet → show `Loading…` and disabled (never permanent: covered by paywall's existing finally-clears-loading; iPad App Review timeout safety: if `paywall.loading === false` and the package is still missing, render label `Coaching unavailable. Please try again later.` disabled, and call `paywall.refresh()` once on mount — no infinite spinner).
- On web: keep the existing `handleStripeCheckout(TIERS.coaching.priceId)` path unchanged.

### 4. `src/pages/Coaching.tsx` and `src/components/CoachingBooking.tsx`

- Same platform gate: when `isRevenueCatAvailable()` is true, replace the "Book & Pay" / "Proceed to Payment" handler with the RC consumable purchase flow + `recordCoachingPurchase`. On non-native, leave existing Stripe flow intact.
- Remove the `window.open(stripeUrl)` call from the iOS code path entirely so no Stripe checkout can be reached from inside the iOS app.

### 5. Backend: record purchase + unlock scheduling

New edge function `supabase/functions/record-coaching-purchase/index.ts` (verify_jwt = true):

- Body: `{ source: "appstore" | "stripe", productId: string, transactionId: string, originalTransactionId?: string, purchaseDateMs?: number }`.
- Inserts into existing `coaching_sessions` table (already in use by `CoachingBooking.handleDone`) with `session_type: "paid_ios"` (or `"paid_web"`), the `transactionId`, and `session_month`.
- Idempotent: unique on `(user_id, transaction_id)` — added by migration below.
- Returns `{ ok: true, calComUrl: "https://cal.com/carnivorex/coaching-session" }` so the client immediately routes to the scheduler.

Migration:

- Add columns `transaction_id text`, `source text` to `coaching_sessions`.
- Add unique index `(user_id, transaction_id) where transaction_id is not null`.

Client utility `src/lib/coachingPurchase.ts` exposes `recordCoachingPurchase({ transaction }): Promise<{ calComUrl: string }>` which calls `supabase.functions.invoke("record-coaching-purchase", ...)` with a 10s timeout and a user-safe toast on failure (the Apple charge is already complete; we surface "Payment received — we couldn't finish scheduling. Tap here to book." instead of silently swallowing).

### 6. Optional but recommended: RevenueCat webhook → backend

Add `supabase/functions/revenuecat-webhook/index.ts` (verify_jwt = false, HMAC-validated against an `RC_WEBHOOK_SECRET` you set in Lovable Cloud) that mirrors `INITIAL_PURCHASE` events for the coaching product into `coaching_sessions`. This is the audit/backup record in case the client request in step 5 never fires (app crashes mid-flow).

This webhook can ship later; step 5's client call is sufficient for the resubmission.

## What stays on Stripe

- `src/pages/Pricing.tsx` Stripe handlers and `supabase/functions/create-coaching-checkout` continue to serve the **web** build (`carnivorex.app`, Lovable preview).
- Inside the iOS app (`Capacitor.isNativePlatform() === true`), no Stripe URL is constructed, opened, or rendered for coaching.

## Apple sandbox testing on iPad — exact terminal steps

Run from the project root on your Mac. Replace `<your-team-id>` as needed; everything else is copy-paste.

```bash
cd ~/path/to/carnivore-coach-pro
git pull
nvm use 22
npm ci
npm run build
npx cap sync ios
cd ios/App
pod install --repo-update
cd ../..
open ios/App/App.xcworkspace
```

In Xcode:

1. Select target **App** → Signing & Capabilities → confirm **In-App Purchase** capability is present (add `+ Capability → In-App Purchase` if missing).
2. Product → Destination → an **iPad** simulator (e.g. iPad Pro 13" M4) **or** your physical iPad with a sandbox Apple ID signed in under iPad **Settings → App Store → Sandbox Account**.
3. Product → Scheme → Edit Scheme → Run → Options → **StoreKit Configuration: None** (we want real sandbox, not a local .storekit file, to mirror App Review).
4. Press ⌘R to launch.
5. Navigate to **Pricing → Book a Call**. Confirm the button shows the localized $ price from the sandbox account's storefront, tap it, complete the sandbox purchase sheet, and verify:
  - Toast: "Coaching call purchased — choose your time."
  - The Cal.com scheduler screen opens.
  - In Supabase → `coaching_sessions` table, a new row exists with `source = 'appstore'` and a non-null `transaction_id`.
6. Edit Scheme → Options → **StoreKit Configuration: None** stays selected. Submit a new TestFlight build via Xcode → Product → Archive → Distribute App.

User: Approve the plan with two changes:

1. keep the coaching call clearly modeled as a standalone consumable IAP, not tied to Elite entitlement logic;
2. do not describe or implement classic restore semantics for the coaching call consumable itself. Also make sure the review build always resolves the coaching package on iPad sandbox so App Review never sees a stuck spinner or inert button.

## Out of scope

- No subscription pricing changes.
- No Cal.com integration changes — we keep the existing `https://cal.com/carnivorex/coaching-session` URL.
- Android coaching IAP — wire later when shipping to Play; the same RC package id works.