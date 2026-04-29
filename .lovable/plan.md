## Diagnosis

The clean build wiped `android/.gradle` and ran `npx cap sync android`, which regenerated `android/variables.gradle` with Capacitor 7's default `minSdkVersion = 24`. Health Connect's `connect-client:1.1.0-alpha10` requires `minSdk ≥ 26`, so manifest merging fails:

```text
uses-sdk:minSdkVersion 24 cannot be smaller than version 26
declared in library [androidx.health.connect:connect-client:1.1.0-alpha10]
```

This is the same root-cause family as the previous Health Connect plugin issue: Capacitor sync overwrites a tracked Android file, and our build pipeline didn't enforce the override afterwards.

## Permanent fix

Make the build script enforce `minSdkVersion = 26` after `npx cap sync`, the same way it already enforces the kotlin-android plugin and copies the Health Connect plugin. That way every fresh build self-heals, even if `variables.gradle` is reset by Capacitor or by a future `cap update`.

## Files to change

1. `scripts/build-android-fresh.sh`
   - After the `npx cap sync android` step (and before Kotlin precompile), patch `android/variables.gradle`:
     - If `minSdkVersion = 24` (or anything < 26), rewrite to `minSdkVersion = 26`.
     - Verify with `grep` afterwards and fail loudly if the value isn't 26.
   - Use a portable `sed -i.bak` (works on macOS 11) and remove the backup.

2. `android/variables.gradle`
   - Set `minSdkVersion = 26` directly (so even non-script local builds in Android Studio work).

3. `mem://constraints/android-min-sdk` (new memory)
   - Record: minSdkVersion must stay ≥ 26 because of Health Connect; build script enforces this after every `cap sync`.

## What you'll do locally after this lands

```bash
cd ~/Desktop/carnivore-coach-pro
git fetch origin
git reset --hard origin/main
git clean -fd
npm install
bash scripts/build-android-fresh.sh
```

The script will set `minSdkVersion = 26` after Capacitor sync, then proceed to Kotlin precompile and APK assembly. The Health Connect manifest-merger error will be gone.

## Notes

- Bumping `minSdk` from 24 → 26 (Android 8.0+) is safe: Health Connect itself already required 26, and 99%+ of active Android devices are on 26+.
- This does not change `targetSdkVersion` (already 36) or `compileSdkVersion` (already 36).
- No JS/UI changes needed.