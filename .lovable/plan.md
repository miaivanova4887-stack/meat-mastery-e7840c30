# Android 16 (API 36) Rebuild Runbook

The clone on your Mac is verified and matches this project:

- commit `1730916` = current `main`
- `minSdkVersion = 26`, `compileSdkVersion = 36`, `targetSdkVersion = 36`
- `versionCode 7`, `versionName "1.1.0"`

Nothing further needs to change in the codebase for the API 36 requirement. What remains is the local build. Two things are NOT in Git (by design) and must exist on your Mac before a Play-ready AAB can be produced:

1. `android/keystore.properties` — your upload keystore credentials (gitignored)
2. Your `.jks` upload keystore file

## Step 1 — Environment check (copy-paste one line at a time)

```bash
cd ~/Desktop/carnivorex-android
```

```bash
node -v
```

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

```bash
"$JAVA_HOME/bin/java" -version
```

Expected: Node `v22.x` or newer, Java `17.x`.

## Step 2 — Clean install of dependencies

```bash
rm -rf node_modules
```

```bash
npm install
```

```bash
npx patch-package
```

## Step 3 — Fresh debug APK (evidence build)

```bash
npm run apk:fresh:debug
```

This script cleans `dist/`, the Gradle project cache, and `android/app/build`, rebuilds web assets, verifies `assetlinks.json`, verifies the speech-recognition ProGuard patch, runs `npx cap sync android`, verifies the synced JS bundle contains the current auth-callback markers, re-pins the SDK levels, and then assembles the APK.

Evidence to paste back:

```bash
grep -n "targetSdkVersion\|compileSdkVersion\|minSdkVersion" android/variables.gradle
```

```bash
shasum -a 256 android/app/build/outputs/apk/debug/app-debug.apk
```

## Step 4 — Install on device and smoke test

```bash
adb devices
```

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Smoke checks on the device:
- Onboarding completes through the wellness disclaimer
- Google sign-in works, sign out, then Google sign-in a **second** time (this is the regression that was fixed)
- Coaching purchase opens Stripe **live** checkout from both the homepage CTA and Profile / My Account, with the US / Canada toggle showing the right price
- Health Connect sync, voice Smart Log, push permission prompt

## Step 5 — Signed release AAB for Play

Only after Step 4 passes.

```bash
ls -1 android/keystore.properties
```

If that file is missing, recreate it from the template:

```bash
cp android/keystore.properties.example android/keystore.properties
```

```bash
open -e android/keystore.properties
```

Fill in the store file path, store password, key alias, and key password for your existing upload keystore, then save.

```bash
cd android
```

```bash
./gradlew clean bundleRelease
```

```bash
ls -lh app/build/outputs/bundle/release/
```

```bash
shasum -a 256 app/build/outputs/bundle/release/app-release.aab
```

Upload `app-release.aab` to the Play Console as versionCode 7 / 1.1.0.

## Notes on Android 16 behavior changes

- Edge-to-edge is enforced; the app already opts in and uses safe-area insets for headers and toasts.
- Orientation/resizability overrides for large screens are handled via the pinned manifest properties (`resizeableActivity=false`, phone portrait lock, tablet detection requiring `sw>=600` AND `SCREENLAYOUT_SIZE_LARGE`).
- No hardcoded SDK 35 references remain; the build script re-pins 26/36/36 after every `cap sync`.

## Technical details

- Capacitor 8 (`@capacitor/core` ^8.2.0, `@capacitor/android` ^8.3.1)
- AGP 8.13.0, Gradle wrapper 8.14.3, Gradle JDK 17 (Android Studio JBR)
- Release signing reads `android/keystore.properties`; the file and the `.jks` are gitignored and never leave your Mac
