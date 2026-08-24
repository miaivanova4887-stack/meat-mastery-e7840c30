# Target Android 16 (API 36) for Play Store submission

## What I found (verified in the repo)

- Capacitor is already v8 (`@capacitor/android ^8.3.1`, `@capacitor/core ^8.2.0`) — Capacitor 8 supports API 36 out of the box.
- `android/variables.gradle` already has `compileSdkVersion = 36`, but `targetSdkVersion = 35` with a comment saying it was deliberately pinned to keep the phone portrait lock working.
- Android Gradle Plugin is already **8.13.0** (requirement is 8.9.0+) — no change needed.
- Gradle wrapper is already **8.14.3** (requirement is 8.11.1+) — no change needed.
- Kotlin JVM target is 21, so the Gradle JDK must be 17 or newer (your setup uses Android Studio's JBR 21) — no change needed.
- No hardcoded SDK numbers in the build: `android/app/build.gradle` reads all three values from `variables.gradle`. The only "35" left is a comment block in `native-plugins/android/build.gradle.kts`, which is documentation only and never compiled.
- The build script `scripts/build-android-fresh.sh` re-pins only `minSdkVersion = 26` after `npx cap sync`; it does not pin compile/target SDK.

So the only real change is `targetSdkVersion` 35 → 36, plus making that stick across `cap sync`.

## Important: minSdk stays at 26, not 24

Capacitor 8's default is `minSdkVersion = 24`, but this app uses Health Connect (`androidx.health.connect:connect-client`), which requires **minSdk 26**. Lowering it to 24 breaks the build. I will keep 26 and leave the existing auto-pin in place.

## Changes

1. `android/variables.gradle`
   - `targetSdkVersion`: 35 → **36**
   - `compileSdkVersion`: 36 (unchanged)
   - `minSdkVersion`: 26 (unchanged, Health Connect)
   - Replace the "pinned to 35" comment with a note describing the API 36 orientation opt-out below.

2. `scripts/build-android-fresh.sh`
   - Extend the existing self-heal step so after `cap sync` it pins and verifies **all three**: `minSdkVersion = 26`, `compileSdkVersion = 36`, `targetSdkVersion = 36`, and fails loudly if any doesn't stick.
   - Print the three resolved values in the build log as build evidence.

3. `native-plugins/android/build.gradle.kts`
   - Update the stale documentation comment (`targetSdkVersion 35`) to 36 so it can't mislead a future edit. Comment-only, no build impact.

4. `android/app/build.gradle`
   - `versionCode` is currently **2**, which Play will reject because your last uploaded bundle was versionCode 6. Bump to **7** (versionName stays `1.1.0`) so the new AAB is accepted.

## Android 16 behavior-change review

- **Portrait lock (the original reason for the 35 pin):** on API 36, orientation/resizability restrictions are ignored on large screens. The manifest already carries the official opt-out — `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY = true`, `PROPERTY_COMPAT_ALLOW_USER_ASPECT_RATIO_OVERRIDE = false`, and `android:resizeableActivity="false"` — which Android 16 still honors at targetSdk 36. Phones keep the portrait lock. Google plans to remove this opt-out in a later release, so tablets/foldables may become resizable in a future Android version; that's a future concern, not a blocker now.
- **Edge-to-edge enforcement:** already handled — the app uses safe-area insets for headers, toasts and bottom nav.
- **Health Connect:** no API 36 breaking change; `connect-client` 1.1.0-alpha10 is compatible. The permission rationale intent filters and `activity-alias` in the manifest stay valid.
- **Deep links / Google OAuth:** App Links (`autoVerify`) and the `carnivorex://` custom scheme are unaffected by API 36.
- **16 KB page size / native libs:** the app ships no custom `.so` files of its own, so no ELF alignment work is required; Play's 16 KB requirement is satisfied by the AGP 8.13 packaging defaults.
- **Predictive back:** not opted in, and not mandatory at API 36 — no action.

## Verification on your machine

After pulling, the normal flow works with no manual Gradle edits:

```text
npm install
npm run apk:fresh:debug      # or ./gradlew bundleRelease from android/
```

The build script will print the pinned SDK values so you can confirm `targetSdkVersion = 36` in the log before the bundle is produced, and `./gradlew bundleRelease` needs `android/keystore.properties` present locally (gitignored) for signing.
