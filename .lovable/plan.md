# Plan: Android subscription regression fix

## Evidence from the APK

The screenshot and adb logs show the same concrete failure:

```text
[RC DEBUG] getOfferings failed [object Object]
[RC ANDROID RAW PRO_MONTHLY] (package not resolved)
[RC ANDROID RAW PRO_YEARLY] (package not resolved)
```

So the Android issue is **not price-field mapping inside a package**. RevenueCat is failing before a package exists. That is why the UI shows:

```text
Unavailable
ANDROID RC DEBUG · monthly
package: (not resolved by RC offering)
```

## Minimal code change

1. **Restore previous working Android behavior for subscriptions**
  - In `src/pages/Pricing.tsx`, change subscription native billing from “any native platform” to **iOS only**.
  - Android will use the existing Stripe checkout path again, matching the previous working Android behavior - this is nonsense, it must be Google Play IAP for subscriptions
  - iOS StoreKit / RevenueCat remains untouched.
2. **Remove the temporary Android debug block from the visible pricing UI**
  - Remove the amber `ANDROID RC DEBUG` block from plan cards.
  - This prevents debug UI from shipping in the next APK.
3. **Keep diagnostic console evidence, but make it readable**
  - In `src/lib/revenuecat.ts`, stringify the `getOfferings` error into one adb-readable line instead of `[object Object]`.
  - In `src/hooks/useNativePaywall.ts`, stringify the RC package diagnostics so adb shows the real error and package state.
4. **Leave the Android RevenueCat price fallback code in place**
  - It is harmless while Android is routed to Stripe.
  - If Android Play Billing is wired later, it will still support `priceString`, `defaultOption`, `fullPricePhase`, `pricingPhases`, and `subscriptionOptions`.

## Expected APK result after approval

- Android Pro / Elite cards no longer show `Unavailable`.
- Android Pro / Elite buttons open Stripe checkout again. - this is nonsense, it must be Google Play IAP for subscriptions
- Coaching calls on Android continue to use Stripe checkout.
- iOS subscriptions and iOS coaching remain on RevenueCat / StoreKit.

## Verification commands after the next APK

```bash
adb logcat -c
adb logcat | grep -E "RC ANDROID RAW|RC DEBUG|revenuecat"
```

Then open the app and go to **Choose Your Plan**. The UI should show Stripe prices/buttons instead of the Android RC debug block.

View History

&nbsp;

Troubleshooting docs
&nbsp;