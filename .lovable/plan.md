# AppsFlyer: install check + one file to repair

## Status: installed

- Package `appsflyer-capacitor-plugin` 6.18.0 is in the app's dependencies and present in the installed packages.
- Android: registered in the native project (settings + app build files).
- iOS: listed in the iOS package manifest.
- App code: started on cold launch from `src/main.tsx` via a single wrapper (`src/lib/appsflyer.ts`) holding the dev key, iOS App Store id `6762581416`, and Android package `com.mi4labs.carnivorex`. Events are already fired from login/registration, onboarding, paywall, subscription, coaching, meal plan, and progress screens. Web is a no-op.
- Purchase events intentionally ship without revenue amounts to avoid double counting with the store-to-AppsFlyer server integration (flag `AF_CLIENT_REVENUE_ENABLED = false`).

## One problem found

`ios/App/CapApp-SPM/Package.swift` contains a leftover duplicated block after the end of the file (a second `targets:` section plus a stray closing parenthesis). That file is invalid Swift and will fail an iOS build. The duplicate also omits AppsFlyer, so nothing is lost by deleting it.

## Proposed fix

Delete the trailing duplicated block (lines 42-58) so the manifest ends after the first, correct `targets:` section — the one that already includes AppsFlyer. No other file changes, no version bump needed (iOS-only, no Android impact).

## Verification

- Confirm the file ends with the single package definition and still lists `AppsflyerCapacitorPlugin`.
- Nothing to test on Android; AppsFlyer there is already wired and unaffected.
