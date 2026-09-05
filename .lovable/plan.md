# Subscription plans show "Unavailable" in the Play Store internal-test build

## What we know

- The plans loaded correctly in an earlier Play Store build, so this is a regression in the app build, not a new Play Store or RevenueCat dashboard setting.
- The screen shows "Unavailable" with no error text, which means the product list came back empty or the lookup failed silently — the app never received prices from Google Play.
- Nothing in the app's product identifiers or store keys changed in the code: the same Android store key and the same plan identifiers (`pro_monthly`, `elite_monthly`, etc.) are still in place.

Because the failure only shows on a store-installed release build, the reason is not visible from the code alone. The plan therefore makes the failure readable first, then fixes the confirmed cause.

## Step 1 — Make the failure visible on the device (no guessing)

Release builds can't be inspected remotely, so the diagnosis has to appear on screen.

- Add a small, admin-only diagnostic panel on the Plans screen that shows exactly what came back from the store: the offering name, how many plans were returned, the plan identifiers, and the raw failure code/message when the lookup fails.
- One tap on Retry then tells us which of the two situations we are in:
  - the lookup **failed** (a store/config error code is shown), or
  - the lookup **succeeded but returned zero plans** (a store-side availability problem).

Only the panel is added; the purchase flow itself is untouched.

## Step 2 — Rule out release-build stripping

The release build shrinks and renames code (`minifyEnabled`/`shrinkResources`), and there are currently **no keep rules** for the purchases or Google Play Billing libraries in `android/app/proguard-rules.pro`. That is a plausible way a build that worked before starts returning nothing, and it costs nothing to close off.

- Add explicit keep rules for the RevenueCat and Google Play Billing classes.
- Confirm by comparison: install the debug build (unshrunk) and the release build side by side. If plans load on debug but not release, stripping is the cause and the keep rules are the fix.

## Step 3 — Compare against the last build that worked

- Read the version code and the bundled plugin versions out of the previously working `.aab` you still have, and compare them with the current build (`versionCode 11`, Android 16 target, Capacitor 8.3.1, purchases plugin 13).
- If the purchases plugin or Capacitor version moved between those two builds, pin back to the versions from the working bundle.

## Step 4 — Store-side checks (only if Step 1 points there)

If the diagnostic shows the lookup succeeded with zero plans, the cause is store-side rather than in the app. Then verify, in this order:

- The subscription products and their base plans are **Active** in Play Console (a base plan can be inactive even when the product is active).
- The offering is still marked **Current** in RevenueCat, with every plan attached to the `pro` / `elite` entitlements.
- RevenueCat's Play Store credentials are still valid — a revoked or expired service-account key makes plans silently disappear while every dashboard screen still looks correct.
- The test account is on the internal-testing tester list and installed via the Play opt-in link (Play Billing returns nothing for accounts outside the track).

## Step 5 — Rebuild and verify

Bump the version code, rebuild the AAB, upload to the internal track, and confirm on device that real prices appear and the Google payment sheet opens. I will give you the exact line-by-line terminal commands for the rebuild.

## Technical notes

- Files touched in Steps 1–2: `src/pages/Pricing.tsx`, `src/hooks/useNativePaywall.ts`, `src/lib/revenuecat.ts` (diagnostic surfacing only), `android/app/proguard-rules.pro`, and `android/app/build.gradle` for the version bump.
- No change to product identifiers, entitlement names, store keys, or the purchase/restore logic.
- The coaching call keeps using the existing card checkout on Android; only subscriptions go through in-app purchases.
