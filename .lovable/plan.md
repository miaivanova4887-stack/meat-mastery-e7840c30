# Plans still show "Unavailable" — build 1.1.4 (12) diagnosis and fix

## What the new test build proved

The on-screen panel now names the cause, and it rules out the app build:

```text
sdkConfigured: true
currentOffering: (none)
allOfferings: (none)
productCount: 0
errCode: 23
errMsg: There is an issue with your configuration.
```

- The store SDK starts up fine inside the release build, so the shrinking/keep-rule
  work from the previous build was not the problem (and stays in, harmless).
- Error 23 is the store's "configuration" error, and **zero** offerings came back —
  not "an offering with no products". That means the store account itself is not
  handing this app any plan list. It is a dashboard/Play-side setup problem, not code.
- Most likely: the subscription store account this app talks to has no Google Play
  app linked (or the linked package name / service-account credentials don't match
  `com.mi4labs.carnivorex`), so no offerings exist for the Android platform at all.

This is consistent with the project having been remixed: the keys in the app still
point at the original store account, while the Play link on that account may be
attached to a different app entry or its Play credentials may have been revoked.

## Step 1 — Confirm the store-account side (no code change)

In the subscription platform dashboard, for the project whose Android key ends
`…NpIPLMW`, check in this order and report what you see:

1. Is there a **Google Play app** in the project, and is its package name exactly
   `com.mi4labs.carnivorex`?
2. Are the **Play service-account credentials** on that app valid (green/verified,
   not "invalid" or "awaiting")?
3. Do the products `pro_monthly`, `pro_yearly`, `elite_monthly`, `elite_yearly`
   exist and are they **imported/linked** to that Google Play app?
4. Is there an **offering marked Current** containing those products, with each
   attached to the `pro` / `elite` entitlements?
5. In Play Console, are the subscriptions and their **base plans Active**, and is
   the test account on the internal-test tester list?

Any single "no" above produces exactly the error 23 + zero offerings seen here.

## Step 2 — Fix whatever Step 1 shows

- Missing/mismatched Play app → add the Google Play app with package
  `com.mi4labs.carnivorex` and upload fresh service-account credentials.
- Missing products → import them from Play, attach to entitlements.
- No Current offering → create/mark the offering Current with all four packages.
- Inactive base plans → activate them in Play Console.

I can also switch the app to a different store account key if the remixed project
should use its own store project instead — tell me and I'll wire the new key.

## Step 3 — Re-verify on device before rebuilding

No rebuild is needed to test Step 2: plan lists are fetched live. Force-stop the
app, reopen Choose Your Plan, tap Retry, and the panel should show
`allOfferings: default`, `productCount: 4` and real prices with the Google payment
sheet opening.

## Step 4 — Wording fix visible in the screenshot

The Subscription Terms block says "Payment is charged to your **Apple ID**" on an
Android device. This will be made platform-aware (Google Play account on Android,
Apple ID on iOS). Cosmetic, shipped with the next build.

## Step 5 — Ship the clean build

Once plans load, remove the red diagnostic panel from user-facing view (keep it
behind `?debug=1`), bump to versionCode 13 / versionName 1.1.5, and I'll give you
the exact line-by-line terminal commands for the rebuild and upload.

## Technical notes

- Error 23 maps to RevenueCat `CONFIGURATION_ERROR`; with `allOfferings` empty the
  failure is upstream of package/entitlement mapping.
- Files touched in Steps 4–5 only: `src/pages/Pricing.tsx` (terms copy + gating the
  panel) and `android/app/build.gradle` (version bump). Keep rules in
  `android/app/proguard-rules.pro` stay as-is.
- No change to product identifiers, entitlement names, or purchase/restore logic.
