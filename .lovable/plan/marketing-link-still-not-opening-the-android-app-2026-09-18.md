# Marketing link still not opening the Android app

## What I checked (and what's already correct)

- The link domain publishes a valid ownership file, and Google's own ownership service returns it for `carnivorex.onelink.me`, listing your app package with your Play signing key. Ownership is good.
- The published app (version 20 / 1.2.2) claims `carnivorex.onelink.me/kWuX` and anything under it, so `…/kWuX/8q584xo1` is inside the claimed range.
- The link itself answers correctly for an Android phone (it serves the AppsFlyer page rather than redirecting away).

So the two things Play Console complained about are in order. What is left is either how the link is being opened, or a per-device verification state — and that can only be settled on the phone.

## Step 1 — Confirm on the phone (before any code change)

I will give you exact one-line commands to run with the phone connected, to read:

- whether Android has actually verified the link domain for the installed app (`verified` vs `legacy_failure`), and
- whether the phone routes the exact link to the app when handed to it directly.

These two outputs tell us definitively whether this is a verification problem, a Chrome hand-off problem, or a link-configuration problem in AppsFlyer. I'll interpret them and then act; no guessing.

## Step 2 — Fixes for the likely causes

Depending on what Step 1 shows, one of these applies:

- **Verified, but taps in the browser still stay on the web page.** This is the most common case: if your website opens the link through a script or button redirect, Android never offers the app. Fix is on the website — the link must be a plain clickable link. Also, if the app was previously set to "open in browser" for this domain, that preference has to be cleared in the phone's app settings (I'll give the exact path).
- **Not verified on the phone.** Then the app's claim needs to cover the domain in the form Android is checking, and the AppsFlyer link setup must list the right signing key. I'll adjust the link rules in the app and bump the version to 21 / 1.2.3 for a new upload.
- **The app opens but always lands on the home screen.** This is a real gap today: the app receives marketing links but ignores them, so nothing specific opens. I'll add handling so a marketing link carrying a destination (recipes, pricing, timer, etc.) navigates there, with home as the fallback. This is a small app change and needs the same rebuild.

## Step 3 — AppsFlyer dashboard check (yours to confirm)

In the OneLink setup for this template, the Android app must be attached with your Play signing SHA-256 and a destination value. If the template has no Android app attached, the link can never open the Android app regardless of what we ship.

## Technical detail

- Current claim: `android:autoVerify="true"`, `scheme=https`, `host=carnivorex.onelink.me`, `pathPrefix=/kWuX`, as its own `intent-filter` in `MainActivity`.
- `src/hooks/useDeepLinks.ts` returns early for any non-auth URL, and `src/lib/appsflyer.ts` only logs the unified-deeplink callback in dev. Step 2's third bullet wires the AppsFlyer unified deep-link callback (and `appUrlOpen` for onelink hosts) to a small allow-listed path map that calls `navigate()`, leaving all existing auth routing untouched.
- Any manifest change requires versionCode 21 / versionName 1.2.3 and a fresh Play upload; existing users must update before links work for them.
