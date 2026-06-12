## Objective
Add evidence-first Android instrumentation for the RevenueCat / Google Play subscription price path, then apply the smallest app-side mapping fix so Android plans render the localized price instead of `Unavailable`.

## Current code path verified
- `src/pages/Pricing.tsx`
  - `getPurchaseContext(...)` reads `paywall.packages[pro_monthly|pro_yearly|elite_monthly|elite_yearly]`.
  - It displays `info?.priceLabel ?? (paywall.loading ? "Loading…" : "Unavailable")`.
- `src/hooks/useNativePaywall.ts`
  - `refresh()` calls `getCurrentOffering()`.
  - It resolves each package through `findPackage(...)`.
  - `toInfo(...)` currently derives price only from `pkg.product?.priceString`.
  - If `priceString` is empty, `priceLabel` becomes only `/mo` or `/yr`; if package resolution fails, Pricing shows `Unavailable`.
- `src/lib/revenuecat.ts`
  - `getCurrentOffering()` currently logs only `identifier`, `productId`, `priceString`, and `subscriptionPeriod`.

## Root cause candidate to prove in APK logs
The code only trusts `pkg.product.priceString`, but RevenueCat Android / Google Play products can expose the formatted subscription price through Google-specific fields:
- `product.defaultOption.fullPricePhase.price.formatted`
- `product.defaultOption.pricingPhases[*].price.formatted`
- `product.subscriptionOptions[*].fullPricePhase.price.formatted`
- `product.subscriptionOptions[*].pricingPhases[*].price.formatted`

The temporary instrumentation will prove exactly which of these is populated in the failing APK.

## Implementation plan
1. **Add Android price resolution helpers in `src/hooks/useNativePaywall.ts`**
   - Add a small runtime-safe resolver that checks, in order:
     1. `pkg.product.priceString`
     2. `pkg.product.defaultOption.fullPricePhase.price.formatted`
     3. last non-free `pkg.product.defaultOption.pricingPhases[*].price.formatted`
     4. first non-free `pkg.product.subscriptionOptions[*].fullPricePhase.price.formatted`
     5. first non-free `pkg.product.subscriptionOptions[*].pricingPhases[*].price.formatted`
   - Use this resolver in `toInfo(...)` and `toCoachingInfo(...)` instead of directly reading `pkg.product?.priceString`.
   - Keep iOS behavior unchanged because `product.priceString` remains first in the chain.

2. **Expose per-package debug metadata from `useNativePaywall.ts`**
   - Extend `NativePackageInfo` with a temporary `debug` object containing:
     - `packageId`
     - `productId`
     - `packageExists`
     - `priceStringExists`
     - `defaultOptionExists`
     - `fullPricePhaseExists`
     - `pricingPhasesExist`
     - `subscriptionOptionsExist`
     - `resolvedPrice`
     - `resolvedSource`
   - Add console logging for each resolved plan, including raw object snapshots for the Pro package.

3. **Log the exact raw Android RevenueCat object for the Pro plan**
   - In `useNativePaywall.refresh()`, after resolving `pro_monthly` / `pro_yearly`, log:
     - `[RC ANDROID RAW PRO PACKAGE]`
     - package identifier
     - full `pkg` object
     - full `pkg.product` object
     - the null/empty matrix for `priceString`, `defaultOption`, `fullPricePhase`, `pricingPhases`, `subscriptionOptions`
   - Guard this to Android native so web/iOS logs are not noisy.

4. **Add temporary on-screen Android debug block under each Pro/Elite plan in `src/pages/Pricing.tsx`**
   - Render only when `Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && useNative`.
   - Place under each paid plan’s price/title area.
   - Show exactly:
     - package id
     - product id
     - package exists
     - priceString exists
     - defaultOption exists
     - pricingPhases exist
     - resolved displayed price value
   - Keep it temporary and narrowly scoped to Android paywall diagnostics.

5. **Apply minimal fix**
   - The actual fix will be the resolver from step 1.
   - Pricing will continue to display `purchase.label`, but `purchase.label` will now come from the populated Android Google Play pricing phase when `priceString` is empty.
   - No changes to backend, Play setup, subscription product IDs, or checkout routing.

## Expected evidence after rebuild
In Android logcat / console, one Pro plan should show a raw object where `priceString` is empty or missing while one of the Google Play pricing phase fields has a formatted price. The on-screen block should show the same resolved price, and the main plan price should no longer say `Unavailable`.