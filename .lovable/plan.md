I’ll fix only the Android build blocker for `@capacitor-community/speech-recognition` and keep the scope limited to the plugin patch plus the existing build verification.

Plan:

1. Regenerate the patch from the current installed package state
   - Temporarily restore `node_modules/@capacitor-community/speech-recognition/android/build.gradle` to the package’s clean upstream value using:
     - `getDefaultProguardFile('proguard-android.txt')`
   - Apply the one intended change to the live installed file:
     - `getDefaultProguardFile('proguard-android-optimize.txt')`
   - Regenerate `patches/@capacitor-community+speech-recognition+7.0.1.patch` using `patch-package`, so the patch metadata and hunk context match the currently installed `7.0.1` package exactly.

2. Remove build-script fallback rewrites
   - Keep the existing `npx patch-package` step in `scripts/build-android-fresh.sh`.
   - Remove the inline `sed -i.bak` fallback rewrite block, because the build should depend on `npx patch-package` applying the patch correctly.
   - Leave only verification grep logic after `npx patch-package`, so the script fails before Gradle if the patch was not applied.
   - If needed, add a temporary diagnostic grep around the existing verification, but no fallback mutation.

3. Validate the real clean-install patch path
   - Simulate the clean package state by setting the live plugin Gradle file back to `proguard-android.txt`.
   - Run `npx patch-package`.
   - Verify that `node_modules/@capacitor-community/speech-recognition/android/build.gradle` now contains `proguard-android-optimize.txt` and no longer contains the exact stale `getDefaultProguardFile('proguard-android.txt')` reference.
   - Confirm the regenerated patch targets only `android/build.gradle` inside `@capacitor-community/speech-recognition`.

Scope guardrails:

- Do not touch iOS files.
- Do not touch Health Connect files.
- Do not modify unrelated package files or app code.
- Do not add fallback rewrites to the build script.