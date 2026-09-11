# Build the release AAB for Play Store (version 1.1.7, code 15)

Follow these in order on your Mac. Open Terminal and copy-paste one line at a time.

## Step 1 — Go to the project folder

```bash
cd ~/Desktop/carnivorex-android
```

```bash
pwd
```

You must see `/Users/mia/Desktop/carnivorex-android`. If not, stop and tell me what it printed.

## Step 2 — Get the latest code

```bash
git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle
```

```bash
git pull
```

## Step 3 — Confirm the version is right

```bash
grep -E "versionCode|versionName" android/app/build.gradle
```

Expected: `versionCode 15` and `versionName "1.1.7"`.

## Step 4 — Confirm the signing file exists

```bash
cat android/keystore.properties
```

You should see four lines (storeFile, storePassword, keyAlias, keyPassword). If the file is missing, stop and tell me — the release build cannot be signed without it.

## Step 5 — Point Java at Android Studio

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

```bash
java -version
```

Keep this same Terminal window for every remaining step.

## Step 6 — Install dependencies and build the web app

```bash
npm install
```

```bash
npm run build
```

## Step 7 — Sync into the Android project

```bash
npx cap sync android
```

## Step 8 — Build the signed release bundle

```bash
cd android
```

```bash
./gradlew clean
```

```bash
./gradlew bundleRelease
```

This takes several minutes. Wait for `BUILD SUCCESSFUL`.

## Step 9 — Find the file and verify it

```bash
ls -lh app/build/outputs/bundle/release/app-release.aab
```

```bash
shasum -a 256 app/build/outputs/bundle/release/app-release.aab
```

```bash
open app/build/outputs/bundle/release/
```

Paste both outputs back to me so I can confirm it's a fresh, correctly signed bundle before you upload.

## Step 10 — Upload

In Play Console, go to your release track and upload `app-release.aab`. Play should show version 15 (1.1.7).

## Notes

- `bundleRelease` produces the `.aab` for Play; `assembleDebug` produces the test `.apk` you've been installing. Don't upload the debug one.
- Signing comes from `android/keystore.properties`, which is intentionally not in Git, so it stays only on your Mac.
- The app config has no live-reload server URL set, so the bundle ships the built web files rather than pointing at the preview — correct for release.
- Target API 36 and minimum API 26 are already set, so no Play warnings expected.
