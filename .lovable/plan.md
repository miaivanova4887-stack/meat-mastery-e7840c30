## Plan

1. **Separate iOS coaching IAP from Android native subscriptions**
  - Keep `useNativePaywall()` / RevenueCat enabled on Android for Google Play subscriptions.
  - Add explicit platform checks where coaching is purchased:
    - iOS native app: RevenueCat / StoreKit coaching consumable.
    - Android native app: Stripe coaching checkout.
    - Web: Stripe coaching checkout.
2. **Fix all coaching entry points**
  - `src/pages/Pricing.tsx`
    - Subscriptions stay RevenueCat on Android/iOS.
    - The coaching card uses StoreKit only on iOS.
    - Android coaching calls `create-coaching-checkout` and opens the returned Stripe URL with the Capacitor Browser helper.
  - `src/pages/Coaching.tsx`
    - Replace `useNative = isRevenueCatAvailable()` with `useIosIap = Capacitor native && platform === "ios"` for coaching only.
    - Android goes to Stripe, not RevenueCat.
  - `src/components/CoachingBooking.tsx`
    - Same platform split: iOS IAP only; Android/web Stripe.
    - The “already paid” no-payment scheduler remains no-payment only for Apple-paid sessions, not all native sessions.
3. **Fix Stripe URL opening on Android**
  - Ensure Android Stripe checkout URLs are opened through `openExternalUrl(...)`, which uses `@capacitor/browser` on native.
  - Avoid `window.open(...)` for the Android coaching Stripe path, because Android WebView can silently block or fail it.
4. **Correct analytics/store labels impacted by the regression**
  - iOS coaching IAP logs `store: "appstore"`.
  - Android coaching Stripe logs `store: "stripe"`.
  - Android subscription purchases through RevenueCat/Google Play should not be mislabeled as App Store in affected analytics calls.
5. **Also provide:**
  - **the exact previous working behavior on Android,**
  - **the exact commit/regression that changed it,**

## Expected result

- Android subscriptions still use RevenueCat / Google Play Billing.
- Android coaching calls trigger Stripe checkout again.
- iOS coaching remains Apple-compliant StoreKit IAP.
- Web coaching remains Stripe.

## Root cause

The regression came from using `isRevenueCatAvailable()` as the coaching payment switch. That helper intentionally returns true for both iOS and Android, which is correct for native subscriptions, but wrong for coaching because only iOS coaching was supposed to move from Stripe to IAP.