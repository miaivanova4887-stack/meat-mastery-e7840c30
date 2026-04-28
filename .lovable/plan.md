## Goal

Make `scripts/build-android-fresh.sh` fail fast with a clear error if the speech-recognition ProGuard patch is not actually present in `node_modules` at the moment Gradle is about to run. Today the script applies the patch and then runs `cap sync`, but it never verifies the patched file before invoking Gradle, so a silent patch failure (or a stale `node_modules` from a previous step) produces a confusing Gradle error instead of a script-level failure.

## Changes (single file)

`scripts/build-android-fresh.sh`:

1. Keep `npx patch-package` exactly where it is (right before `npx cap sync android`) — already correct.
2. Immediately after `npx patch-package` and **before** `npx cap sync android`, add a verification step that greps the plugin's gradle file:

   ```bash
   PLUGIN_GRADLE="$ROOT_DIR/node_modules/@capacitor-community/speech-recognition/android/build.gradle"

   echo "🔎 Verifying speech-recognition ProGuard patch..."
   if [[ ! -f "$PLUGIN_GRADLE" ]]; then
     echo "❌ Missing plugin gradle file: $PLUGIN_GRADLE"
     echo "   Did 'npm install' run? Aborting before Gradle."
     exit 1
   fi
   if ! grep -q "proguard-android-optimize.txt" "$PLUGIN_GRADLE"; then
     echo "❌ Patch not applied: $PLUGIN_GRADLE still references the removed 'proguard-android.txt'."
     echo "   Expected 'proguard-android-optimize.txt' (see patches/@capacitor-community+speech-recognition+7.0.1.patch)."
     echo "   Try: rm -rf node_modules && npm install && npx patch-package"
     exit 1
   fi
   if grep -q "getDefaultProguardFile('proguard-android.txt')" "$PLUGIN_GRADLE"; then
     echo "❌ Stale reference to 'proguard-android.txt' still present in $PLUGIN_GRADLE."
     exit 1
   fi
   echo "✅ Patch verified: proguard-android-optimize.txt present"
   ```

3. Leave everything else (cap sync, plugin copy, icons, gradle assemble) unchanged.

## Why this is enough

- `set -euo pipefail` is already enabled, so `exit 1` aborts cleanly with the printed reason.
- The check runs **after** `patch-package` (catches a failed patch) and **before** `cap sync` + Gradle (so we never reach the misleading Gradle error).
- Both positive (`grep -q optimize`) and negative (`grep -q` for the old line) checks are included to defend against partial patches.

## Out of scope

- iOS files: untouched.
- Health Connect plugin: untouched.
- `package.json`, the `.patch` file, and `postinstall` wiring: untouched (already correct).

## Verification after running the updated script

- On a healthy tree: prints `✅ Patch verified` and proceeds to a successful APK at `android/app/build/outputs/apk/debug/app-debug.apk`, then prints SHA256.
- On a broken tree (e.g. node_modules wiped without reinstall, or patch silently rejected): aborts at the verify step with a one-line actionable error, no Gradle invocation.
