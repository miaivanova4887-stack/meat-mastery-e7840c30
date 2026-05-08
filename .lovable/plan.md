# Debug RevenueCat "Unavailable" on Android

## Findings (audit results)

1. **`src/lib/revenuecat.ts`** — Android key is now the real `goog_LJgdLQzxkXUPLaORSMbZNpIPLMW` (no longer placeholder). `Purchases.configure()` runs eagerly on context mount, before any `getOfferings()` call. ✅
2. **`src/contexts/SubscriptionContext.tsx`** lines 47/56 — `initRevenueCat` is called on mount and again after auth resolves. Not lazy. ✅
3. **`useNativePaywall`** awaits `getCurrentOffering()` inside try/catch and exposes `loading`/`error`. `Pricing.tsx` shows `"Loading…"` while loading and `"Unavailable"` only when offering resolved but package missing. ✅
4. **`capacitor.config.json`** → `appId: "com.mi4labs.carnivorex"` ✅
5. **`android/app/build.gradle`** → `applicationId "com.mi4labs.carnivorex"` and `namespace = "com.mi4labs.carnivorex"` ✅
6. **`@revenuecat/purchases-capacitor` ^13.0.0** with **`@capacitor/core` ^8.2.0** — RC Capacitor v13 requires Capacitor 7+. ✅ compatible.

So code/config are clean. The remaining failure modes are dashboard-side (offering not marked Current, packages empty, Play products not Active, package name mismatch in RC app, license tester not added). To prove which one, we need device logs.

## Plan: add debug instrumentation (no behavior change)

### 1. `src/lib/revenuecat.ts`
- Bump RC log level to `LOG_LEVEL.DEBUG` on Android (keep INFO on iOS) so Logcat shows full Play Billing trace.
- In `getCurrentOffering()`, after `Purchases.getOfferings()`, log:
  - `current?.identifier`
  - `Object.keys(all ?? {})`
  - For `current.availablePackages`: each `{ identifier, product.identifier, product.priceString, product.subscriptionPeriod }`
  - On error: full error object including `code` and `underlyingErrorMessage`.
- In `initRevenueCat()`, log the resolved platform + key prefix (first 8 chars only) on success.

### 2. `src/hooks/useNativePaywall.ts`
- Log resolved `packages` map keys + counts after `refresh()` settles.

### 3. `src/pages/Pricing.tsx` — opt-in debug panel
- When `?debug=1` is in the URL, render a small card at the top of the page (above the billing toggle) showing:
  - `enabled` (RC available)
  - `loading`
  - `error`
  - `offering.identifier ?? "(none)"`
  - `availablePackages.length`
  - For each package: `identifier` · `product.identifier` · `priceString`
- No changes to existing card rendering or purchase logic.

### 4. No changes to
- `capacitor.config.json`, `android/app/build.gradle`, package versions — all verified correct.
- `SubscriptionContext` init flow — already eager.

## How the user uses this

1. Approve plan → rebuild Android (`scripts/build-android-fresh.sh`) → install via Play internal track.
2. Open `…/pricing?debug=1` in the app. The panel will say one of:
   - **`offering: (none)`** → RC dashboard issue: no offering marked "Current" for the Android app, OR the Play app isn't linked to this RC project, OR the `goog_…` key belongs to a different RC project than the one with the offering.
   - **`offering: default, packages: 0`** → Offering exists but has no packages attached in RC dashboard → Offerings → Packages.
   - **`packages: 4` but `priceString` is empty** → Play Billing returned products but without prices → product not in "Active" state on Play Console, or tester account not added to internal track / not opted in.
   - **`packages: 4` with prices** → Code is fine; the previous "Unavailable" was the placeholder-key build. Done.
3. Capture `adb logcat | grep -iE "revenuecat|billing"` and share if the panel alone isn't conclusive.

## Files touched
- `src/lib/revenuecat.ts` (logging only)
- `src/hooks/useNativePaywall.ts` (logging only)
- `src/pages/Pricing.tsx` (gated debug panel)
