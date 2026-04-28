# Fix Android build failure from @capacitor-community/speech-recognition

## Root cause

`node_modules/@capacitor-community/speech-recognition/android/build.gradle` (v7.0.1) declares:

```gradle
proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
```

Android Gradle Plugin 8.x (this project uses AGP 8.7.2) no longer ships `proguard-android.txt`. Only `proguard-android-optimize.txt` is bundled, so Gradle fails resolving the default proguard file for the plugin's release build.

Upstream has not shipped a fixed release for v7.x, so we patch locally.

## Fix (smallest safe change)

1. Edit `node_modules/@capacitor-community/speech-recognition/android/build.gradle` — replace `'proguard-android.txt'` with `'proguard-android-optimize.txt'` (single line change inside the `release` block).
2. Add `patch-package` so the fix survives `npm install` / CI / `cap sync`:
  - Add `patch-package` as a devDependency.
  - Add `"postinstall": "patch-package"` to `package.json` scripts.
  - Generate `patches/@capacitor-community+speech-recognition+7.0.1.patch` capturing the one-line gradle change.
3. Update `scripts/build-android-fresh.sh` so `npm install` (or an explicit `npx patch-package`) runs before `npx cap sync`, guaranteeing the patch is applied on a fresh checkout. Currently the script jumps straight from `npm run build` to `npx cap sync` without ensuring the patch step ran — we'll add an explicit `npx patch-package` call right before `cap sync` as a safety net (no-op if already applied).
4. Re-run the existing `bash scripts/build-android-fresh.sh` to produce a fresh debug APK.

## Files touched

- `package.json` — add devDependency + postinstall script
- `patches/@capacitor-community+speech-recognition+7.0.1.patch` — new patch file
- `node_modules/@capacitor-community/speech-recognition/android/build.gradle` — apply patch
- `scripts/build-android-fresh.sh` — add `npx patch-package` safety call

## Out of scope

- iOS files: untouched.
- Health Connect plugin: untouched.
- No web/UI changes.

## Verification

- `npm install` → confirm postinstall logs "Applying patches… @capacitor-community/[speech-recognition@7.0.1](mailto:speech-recognition@7.0.1) ✔".
- `grep proguard-android-optimize node_modules/@capacitor-community/speech-recognition/android/build.gradle` → matches.
- Run `bash scripts/build-android-fresh.sh`; expect a successful debug APK at `android/app/build/outputs/apk/debug/app-debug.apk` and report SHA256.

&nbsp;

**Fix the Android build failure caused by** `@capacitor-community/speech-recognition` **by patching its Android Gradle file to use** `getDefaultProguardFile('proguard-android-optimize.txt')` **instead of** `proguard-android.txt`**. Keep the change persistent with** `patch-package` **via a** `postinstall` **script, and add an explicit patch application step before** `npx cap sync` **in** `scripts/build-android-fresh.sh`**. Do not change iOS or the Health Connect plugin for this step.**