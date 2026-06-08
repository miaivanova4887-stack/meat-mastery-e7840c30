## Stack detection

This repo is **Capacitor 8** (React + Vite + TS) with native **iOS (SPM)** and **Android (Gradle)** projects already generated. RevenueCat is the IAP layer; Firebase Analytics is already wired. No React Native / Expo.

Correct integration path: `**appsflyer-capacitor-plugin**` (official AppsFlyer plugin for Capacitor). It ships native iOS (SPM-compatible) and Android modules and exposes a JS API — no CocoaPods required, no manual Swift/Kotlin needed for the base SDK.

## What I will do

### 1. Add the plugin

- `bun add appsflyer-capacitor-plugin`
- Register it in `ios/App/CapApp-SPM/Package.swift` and confirm Android auto-link via `capacitor.build.gradle` after `npx cap sync`.
- No changes to `Podfile` (none exists; iOS is SPM).
- iOS: add `NSUserTrackingUsageDescription` to `Info.plist` (required by AppsFlyer for ATT-aware install attribution; safe even if we don't call ATT yet — value: "We use this to measure ad performance and improve your experience.").
- Android: AppsFlyer plugin auto-adds `INTERNET` (already present) and `ACCESS_NETWORK_STATE`. No manual manifest edits.

### 2. Secrets / config

- `DEV_KEY` (`Uk5UhKPSaBzxQTYfqDWZsj`) and iOS `APP_ID` (`id6762581416` → numeric `6762581416`) are **client-side identifiers**, not server secrets — store them in code as constants in `src/lib/appsflyer.ts` (same pattern as the Supabase publishable key and Firebase config). No secrets tool needed.
- Debug logging gated by `import.meta.env.DEV`.

### 3. Centralized analytics wrapper

New file `src/lib/appsflyer.ts`:

- `initAppsFlyer()` — idempotent, native-only guard via `Capacitor.isNativePlatform()`. Calls `AppsFlyer.initSDK({ devKey, appId: '6762581416', isDebug: DEV, waitForATTUserAuthorization: 0, minTimeBetweenSessions: 4 })`.
- `logAfEvent(name, params?)` — wraps `AppsFlyer.logEvent`; no-op + console.debug on web.
- `AF_EVENTS` constants — AppsFlyer predefined names where applicable (`af_login`, `af_complete_registration`, `af_purchase`, `af_initiated_checkout`) plus snake_case customs (`onboarding_completed`, `paywall_viewed`, `subscription_started`, `coaching_cta_tapped`, `coaching_purchase_success`, `coaching_booking_completed`, `meal_plan_generated`, `progress_logged`).
- Param helpers mapping to AppsFlyer predefined param keys (`af_revenue`, `af_currency`, `af_content_id`, `af_content_type`, `af_order_id`).

### 4. Lifecycle init

Call `initAppsFlyer()` from `src/main.tsx` right after `./lib/firebase` import — same place Firebase initializes — so SDK starts on cold launch before React mounts. The plugin's `initSDK` is what AppsFlyer documents as the "start" call for Capacitor, so no extra `start()` is needed.

### 5. Event hooks (only at existing trigger points)


| Event                                                            | Trigger location                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `af_complete_registration` (method)                              | `src/contexts/AuthContext.tsx` post-signup success                                                                   |
| `af_login` (method: password/google/apple)                       | `src/contexts/AuthContext.tsx` post-signin success                                                                   |
| `onboarding_completed`                                           | `src/pages/Onboarding.tsx` final wellness-consent step                                                               |
| `paywall_viewed` (source_screen)                                 | `src/pages/Pricing.tsx` and `src/pages/Coaching.tsx` mount                                                           |
| `af_initiated_checkout` (plan_id, price, currency, store)        | `src/hooks/useNativePaywall.ts` / `src/lib/coachingPurchase.ts` before purchase call                                 |
| `subscription_started` (plan_id, price, currency, store)         | `SubscriptionContext` on tier upgrade detected                                                                       |
| `coaching_cta_tapped` (source_screen)                            | `src/components/MotivationCTA.tsx` / `CoachingBooking.tsx` CTA click                                                 |
| `coaching_purchase_success` (product_id, price, currency, store) | `src/lib/coachingPurchase.ts` post-RC success / `supabase/functions/record-coaching-purchase` client-side after-call |
| `af_purchase` (revenue, currency, order_id, content_type)        | **See §6 — gated to avoid double counting**                                                                          |
| `coaching_booking_completed`                                     | `src/components/CoachingBooking.tsx` after Cal.com redirect confirm                                                  |
| `meal_plan_generated`                                            | `src/pages/MealPlan.tsx` / `supabase/functions/meal-plan-ai` client success handler                                  |
| `progress_logged` (category)                                     | `src/hooks/useProgress.ts` on insert success                                                                         |


### 6. Revenue de-duplication (important)

RevenueCat is the source of truth for IAP. AppsFlyer has an **S2S RevenueCat integration** (RC → AppsFlyer purchase events) that is configured in the AppsFlyer dashboard, not in app code. If the user has enabled that integration, firing `af_purchase` client-side will **double-count revenue**.

Plan: ship `af_purchase`/`coaching_purchase_success` **without `af_revenue**` by default (only product_id + currency + store), and add a single flag `AF_CLIENT_REVENUE_ENABLED = false` in `src/lib/appsflyer.ts`. Flip to `true` only if the user confirms RC→AppsFlyer S2S is NOT configured. This is the "flag instead of blindly duplicate" behavior requested.

### 7. Deep link / conversion listener

A safe, non-intrusive listener that only logs to console + analytics buffer — does NOT navigate, so it cannot break the existing `useDeepLinks` / `usePushNavigation` routing:

- `AppsFlyer.addListener('onConversionDataSuccess', …)` — log first-install source for attribution debugging.
- `AppsFlyer.addListener('onAppOpenAttribution', …)` — log deep-link payload only.
- Registered inside `initAppsFlyer()`. No router calls.

### 8. Files changed

- `package.json` (new dep)
- `ios/App/CapApp-SPM/Package.swift` (plugin product; updated by `cap sync`)
- `ios/App/App/Info.plist` (NSUserTrackingUsageDescription)
- `android/app/capacitor.build.gradle` (auto by `cap sync`)
- `src/lib/appsflyer.ts` (new — wrapper, constants, init, listeners)
- `src/main.tsx` (call `initAppsFlyer()`)
- `src/contexts/AuthContext.tsx` (login + signup hooks)
- `src/contexts/SubscriptionContext.tsx` (subscription_started)
- `src/pages/Onboarding.tsx` (onboarding_completed)
- `src/pages/Pricing.tsx` (paywall_viewed)
- `src/pages/Coaching.tsx` (paywall_viewed)
- `src/hooks/useNativePaywall.ts` (initiated_checkout + purchase)
- `src/lib/coachingPurchase.ts` (coaching_purchase_success)
- `src/components/MotivationCTA.tsx` (coaching_cta_tapped)
- `src/components/CoachingBooking.tsx` (coaching_cta_tapped + coaching_booking_completed)
- `src/pages/MealPlan.tsx` (meal_plan_generated)
- `src/hooks/useProgress.ts` (progress_logged)

### 9. Manual dashboard / external steps (user must do)

1. In AppsFlyer dashboard → My Apps → confirm iOS app `id6762581416` and Android app `com.mi4labs.carnivorex` are both registered.
2. Confirm or disable the **RevenueCat → AppsFlyer** S2S purchase integration. Tell me which, so I can set `AF_CLIENT_REVENUE_ENABLED` correctly.
3. (iOS) SKAdNetwork IDs — AppsFlyer provides a list; add to `Info.plist` if running paid UA campaigns (not required for SDK init).
4. (iOS) If you want ATT prompt, add `@capacitor-community/app-tracking-transparency` later — out of scope here; AppsFlyer still works (limited attribution) without it.
5. After `npx cap sync ios`, open Xcode once to let SPM resolve the AppsFlyer package.

### 10. Verification checklist

**iOS**

- `bun add` succeeds, `npx cap sync ios` succeeds, Xcode resolves SPM package.
- App launches; Xcode console shows `[AppsFlyerSDK]` debug lines in Debug build only.
- AppsFlyer dashboard → Real-time → install event appears within ~1 min of fresh install.
- Trigger login → `af_login` visible in Real-time events.
- Trigger a sandbox StoreKit purchase → `af_initiated_checkout` + `coaching_purchase_success` visible; revenue counted **once** (RC-side OR client-side, not both).

**Android**

- `npx cap sync android` succeeds; `./gradlew :app:assembleDebug` succeeds.
- Logcat filter `AppsFlyer_` shows debug logs.
- Same dashboard checks as iOS for `com.mi4labs.carnivorex`.

Correction before implementation:

This app is iOS only. There is no Android project. Adjust the plan accordingly:

Remove entirely:

All Android/Gradle steps

npx cap sync android

./gradlew :app:assembleDebug verification

android/app/[capacitor.build](http://capacitor.build).gradle from files changed

Android Logcat verification steps

Android FCM/uninstall measurement note

Any reference to com.mi4labs.carnivorex Android package

Keep everything iOS-related as planned:

bun add appsflyer-capacitor-plugin

SPM registration in ios/App/CapApp-SPM/Package.swift via npx cap sync ios

NSUserTrackingUsageDescription in Info.plist

initAppsFlyer() with iOS APP_ID: '6762581416' and DEV_KEY: 'Uk5UhKPSaBzxQTYfqDWZsj'

All event hooks, the analytics wrapper, revenue de-duplication flag, and deep link listeners unchanged

Adjust verification checklist to iOS only:

bun add succeeds, npx cap sync ios succeeds, Xcode resolves SPM package

[AppsFlyerSDK] debug lines visible in Xcode console on Debug builds only

AppsFlyer dashboard Real-time → install event appears within ~1 min of fresh install on device

Trigger login → af_login visible in Real-time events

Trigger sandbox StoreKit purchase → af_initiated_checkout + coaching_purchase_success visible; revenue counted once

Adjust dashboard steps to remove Android app registration. Only iOS app id6762581416 needs to be confirmed in the AppsFlyer dashboard.

Everything else in the plan — wrapper design, event list, revenue flag, deep link listener, SPM blocker callout — remains approved as written.

### 11. Known assumptions / blockers (called out before implementation)

- **No CocoaPods will be added.** If the AppsFlyer Capacitor plugin's current version requires CocoaPods on iOS (some older versions do), I will stop and surface it instead of converting your iOS project off SPM.
- **Native FCM is currently gated** (`NATIVE_FCM_ENABLED` false). AppsFlyer Uninstall Measurement on iOS reuses APNs token — works regardless; on Android it uses FCM, so uninstall measurement will be limited until FCM is enabled. Not a blocker for install/event tracking.
- **AppsFlyer MCP server is a tool for me**, not something deployed to the app — it won't appear in user-facing code.
- I will not modify Stripe/Cal.com server flows, the RC IAP product config, or any backend edge functions.