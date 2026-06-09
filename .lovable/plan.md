# Android Parity Release — Audit & Plan

## 1. Recent iOS-era changes → Android impact map


| #   | Recent change                                                                                                                            | Layer                       | Android status                                                                                                                                                                                                                                                                                                   | Action                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Coaching purchase flow + pricing fixes (`Coaching.tsx`, `CoachingBooking.tsx`, `Pricing.tsx`, `useNativePaywall`, `coachingPurchase.ts`) | Shared React                | Already shared. `isRevenueCatAvailable()` already returns true on Android; `REVENUECAT_ANDROID_KEY` is set.                                                                                                                                                                                                      | No code change. QA only.                                                                                                         |
| 2   | Storefront-localized price strings via `product.priceString`                                                                             | Shared (RC SDK)             | RC surfaces Google Play localized prices identically.                                                                                                                                                                                                                                                            | None.                                                                                                                            |
| 3   | Security migration (revoke column SELECT on `coaching_sessions`)                                                                         | Backend                     | Platform-agnostic.                                                                                                                                                                                                                                                                                               | None.                                                                                                                            |
| 4   | AppsFlyer SDK integration (`src/lib/appsflyer.ts`, `main.tsx`, event hooks)                                                              | Shared + native             | **Partial**. JS wrapper runs on Android, but: (a) `appID` is hardcoded to the iOS numeric id `6762581416`; (b) `npx cap sync android` has not been run since the plugin was added — `android/app/capacitor.build.gradle` does **not** yet list `appsflyer-capacitor-plugin`, so the Android module isn't linked. | Implement (see §3).                                                                                                              |
| 5   | iOS `Info.plist` `NSUserTrackingUsageDescription`                                                                                        | iOS-native                  | Not applicable to Android (no ATT on Android).                                                                                                                                                                                                                                                                   | Mark N/A.                                                                                                                        |
| 6   | `Package.swift` SPM registration of AppsFlyer                                                                                            | iOS-native                  | N/A — Android auto-links via Gradle after `cap sync`.                                                                                                                                                                                                                                                            | Mark N/A.                                                                                                                        |
| 7   | RC→AppsFlyer S2S revenue-dedup flag (`AF_CLIENT_REVENUE_ENABLED`)                                                                        | Shared                      | Applies identically on Android.                                                                                                                                                                                                                                                                                  | None.                                                                                                                            |
| 8   | Auth hooks (`af_login` / `af_complete_registration`)                                                                                     | Shared                      | Works on Android once §3 lands.                                                                                                                                                                                                                                                                                  | None.                                                                                                                            |
| 9   | Onboarding completion + meal-plan + progress events                                                                                      | Shared                      | Same.                                                                                                                                                                                                                                                                                                            | None.                                                                                                                            |
| 10  | Sign in with Apple groundwork (any iOS-only auth paths)                                                                                  | iOS-native                  | Apple is iOS-only by product definition. Android continues with Google + email via `@capgo/capacitor-social-login` (already wired).                                                                                                                                                                              | Mark N/A; verify Google flow still routes through existing `carnivorex://auth` intent filter (already in `AndroidManifest.xml`). |
| 11  | Deep link / attribution listeners in `initAppsFlyer()`                                                                                   | Shared                      | Will fire on Android once plugin is linked. They only log — they do not navigate, so no conflict with `useDeepLinks` / `usePushNavigation`.                                                                                                                                                                      | None beyond §3.                                                                                                                  |
| 12  | Push permission / "open settings" UX                                                                                                     | Shared with platform guards | Android already uses `capacitor-native-settings` + `POST_NOTIFICATIONS` permission. Native FCM **disabled on Android** (`NATIVE_FCM_ENABLED_ANDROID=false`) until `google-services.json` ships.                                                                                                                  | Decision needed (see §5).                                                                                                        |
| 13  | Pricing / paywall UI fixes                                                                                                               | Shared                      | Same.                                                                                                                                                                                                                                                                                                            | None.                                                                                                                            |
| 14  | Navigation / app-shell tweaks                                                                                                            | Shared React                | Same.                                                                                                                                                                                                                                                                                                            | None.                                                                                                                            |


## 2. Confirmed already-shared (no Android work)

Coaching flow, paywall UI, pricing strings, RC purchase + restore, AppsFlyer event hooks at all call sites, revenue-dedup flag, deep-link listener registration, security migration, onboarding/meal-plan/progress analytics.

## 3. Android changes to implement

### 3a. AppsFlyer Android linkage

- Edit `src/lib/appsflyer.ts`:
  - Replace the single `AF_IOS_APP_ID` constant with a per-platform resolver. iOS keeps `"6762581416"`. Android passes the **package name** `"com.mi4labs.carnivorex"` as `appID` (AppsFlyer Capacitor plugin requires the field on both platforms; on Android it's used purely as an identifier — the install is keyed off the package name).
  - Pass the resolved value into `AppsFlyer.initSDK({ appID, … })`.
- Run `npx cap sync android` so:
  - `android/capacitor.settings.gradle` includes `appsflyer-capacitor-plugin`.
  - `android/app/capacitor.build.gradle` adds the `implementation project(':appsflyer-capacitor-plugin')` line.
  - Plugin's `AndroidManifest.xml` is merged (it provides `ACCESS_NETWORK_STATE`; `INTERNET` is already declared).
- No manual edits to `android/app/build.gradle` are needed; the plugin's transitive `af-android-sdk` is declared in its own module.
- No ProGuard rules required for AppsFlyer SDK 6.18.x at the consumer level (the plugin ships its own consumer rules).

### 3b. Versioning for Play parity release

- `android/app/build.gradle`: bump `versionCode` (currently `1`) and `versionName` (currently `"1.0"`) to a release candidate aligned with the iOS build. Use `versionCode 2`, `versionName "1.1.0"` (or whatever the next iOS build is — confirm before bump).

### 3c. Verify Android-specific guards untouched

- `pushNativeConfig.ts` — `NATIVE_FCM_ENABLED_ANDROID = false` stays unless §5 is unblocked.
- Health Connect, portrait lock, TTS, speech recognition patches: not part of the last-10-days iOS scope → no changes.

## 4. Files to be changed

- `src/lib/appsflyer.ts` — per-platform `appID`.
- `android/app/build.gradle` — version bump.
- Generated by `npx cap sync android` (no manual edit): `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`.

## 5. Open product decisions (blocked items)

- **Push on Android**: shipping the parity release with FCM disabled means Android users get no notifications. Either (a) accept the gap and document it in the Play listing, or (b) add `android/app/google-services.json` and flip `NATIVE_FCM_ENABLED_ANDROID` to `true`. **Out of scope for this task unless you decide to unblock.**
- **RC↔AppsFlyer S2S**: same flag (`AF_CLIENT_REVENUE_ENABLED=false`) applies to Android. Confirm whether S2S is enabled in AppsFlyer dashboard for the Android app `com.mi4labs.carnivorex`. If not, flip to `true` so Play purchases report revenue.
- **AppsFlyer dashboard**: ensure the Android app entry `com.mi4labs.carnivorex` exists alongside the iOS app — otherwise events will be dropped server-side.

## 6. Android build & QA checklist (post-implementation)

1. `bun install`
2. `bun run build`
3. `npx cap sync android`
4. Verify `android/app/capacitor.build.gradle` now contains `implementation project(':appsflyer-capacitor-plugin')`.
5. `bash scripts/build-android-fresh.sh` (per project memory: builds debug APK with the timestamped naming).
6. Install on a physical device with `adb install -r …`.
7. Logcat: `adb logcat | rg -i "AppsFlyer|RevenueCat|CarnivoreX"`.
  - Expect `[AppsFlyer] initSDK ok` and `AppsFlyer_*` native debug lines.
  - Expect RC `configured platform=android keyPrefix=goog_`.
8. AppsFlyer dashboard → Real-time → confirm install + `af_login` + `paywall_viewed` for `com.mi4labs.carnivorex`.
9. Google Play sandbox purchase of Pro monthly → confirm `af_initiated_checkout` then `af_purchase` (or RC S2S event), and that `subscription_started` fires once.
10. Coaching consumable purchase via Google Play sandbox → `coaching_purchase_success` fires, `record-coaching-purchase` edge function records the session.
11. Deep link smoke test: open `https://app.carnivorex.app/auth/callback?...` — verify it routes to MainActivity (App Links) and AppsFlyer logs an OAOA/UDL callback (log only — should not change navigation).
12. Push permission UX: trigger from Settings → confirm Android 13+ system prompt and the "Open settings" fallback opens the app's notification screen (via `capacitor-native-settings`). **Note**: native FCM disabled, so no token will register — this is expected until §5 is resolved.
13. Verify `versionCode` / `versionName` in the built APK via `aapt dump badging`.

## 7. Remaining parity gaps (explicit)

- Push notifications on Android: gap by design until `google-services.json` is provided.
- Sign in with Apple: N/A on Android by product definition.
- ATT prompt: N/A on Android.

## 8. Out of scope

Anything older than ~20 days, Health Connect changes, CMS, recipe AI, exercise/yoga flow, theme refinements, and general Android cleanup unrelated to the recent iOS work.