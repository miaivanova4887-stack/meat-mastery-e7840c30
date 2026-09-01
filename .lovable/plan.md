# Build a Play-ready signed AAB

Current repo state (verified): `versionCode 7`, `versionName "1.1.0"`, `minSdk 26`, `compileSdk 36`, `targetSdk 36`. Release signing reads `android/keystore.properties`, which is gitignored and not in the repo — it must exist on your Mac.

## Step 0 — Open a terminal and go to the clone

```bash
cd ~/Desktop/carnivorex-android
```

```bash
git pull origin main
```

## Step 1 — Environment

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

```bash
"$JAVA_HOME/bin/java" -version
```

```bash
node -v
```

Expected: Java `17.x` or newer, Node `v22.x` or newer.

## Step 2 — Clean dependency install

```bash
rm -rf node_modules
```

```bash
npm install
```

```bash
npx patch-package
```

## Step 3 — Debug APK first (evidence build)

Never sign a release you have not smoke-tested.

```bash
npm run apk:fresh:debug
```

```bash
grep -n "minSdkVersion\|compileSdkVersion\|targetSdkVersion" android/variables.gradle
```

```bash
shasum -a 256 android/app/build/outputs/apk/debug/app-debug.apk
```

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Smoke checks on the device: onboarding through the wellness disclaimer, Google sign-in returning into the app twice in a row (sign out in between), coaching checkout opening live Stripe with the US/Canada toggle, Health Connect sync, voice Smart Log, push permission prompt.

## Step 4 — Signing credentials

```bash
ls -1 android/keystore.properties
```

If that prints "No such file", recreate it:

```bash
cp android/keystore.properties.example android/keystore.properties
```

```bash
open -e android/keystore.properties
```

Fill in `storeFile` (absolute path to your existing `.jks`), `storePassword`, `keyAlias`, `keyPassword`, then save. Use the same upload keystore as version 6 — a different key makes Play reject the upload.

```bash
ls -l "$(grep '^storeFile=' android/keystore.properties | cut -d= -f2-)"
```

That must list your `.jks` file.

## Step 5 — Build the signed AAB

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

## Step 6 — Verify the bundle before upload

```bash
"$JAVA_HOME/bin/jarsigner" -verify -verbose:summary app/build/outputs/bundle/release/app-release.aab | head -20
```

Expected: `jar verified`.

```bash
unzip -p app/build/outputs/bundle/release/app-release.aab BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties
```

## Step 7 — Upload to Play Console

1. Play Console → your app → Production (or Internal testing) → Create new release.
2. Upload `android/app/build/outputs/bundle/release/app-release.aab`.
3. Confirm it registers as versionCode 7 / 1.1.0 and that Play reports target API 36.
4. Add release notes, save, review, roll out.

If Play warns about a signing-key mismatch, stop and do not create a new key — that means the wrong keystore was referenced in Step 4.

## Notes

- Frontend changes must also be published from Lovable so the live domain matches the app bundle (the Google OAuth bridge page at `/auth/native-callback` lives on the web domain).
- No code changes are needed for this submission; if you want the versionCode bumped past 7 for a second upload attempt, say so and I will change `android/app/build.gradle`.
