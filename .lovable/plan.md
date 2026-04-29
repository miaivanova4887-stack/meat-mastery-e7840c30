## Diagnosis

Your `git pull` is blocked because `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` is tracked by Git, but the Android build script also rewrites that same file from `native-plugins/.../HealthConnectPlugin.kt` every time you build.

That means the file is acting like a generated copy, but Git treats it like a normal source file. After a local build, Git sees it as locally changed, so future pulls fail with:

```text
Your local changes to the following files would be overwritten by merge:
  android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
```

The permanent fix is to make there be one canonical source of truth and make the generated Android copy untracked/ignored.

## Plan

1. Treat `native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` as the only canonical Health Connect plugin source.
2. Stop tracking the generated copy under `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`.
3. Add that generated copy path to `.gitignore` so builds can rewrite it without dirtying the repo.
4. Keep `scripts/build-android-fresh.sh` copying the canonical native plugin into the Android project before compilation.
5. Add/keep build guard checks so the script still fails if the copied plugin is stale or missing the weight/permission fixes.
6. Provide a one-time cleanup command for your Mac to clear the existing local conflict safely.

## Files to change after approval

- `.gitignore`
- Git tracking state for `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`
- Possibly `scripts/build-android-fresh.sh` only if it needs a clearer message around generated-file behavior

## One-time command you will run locally after the fix lands

After the change is merged to GitHub, your local machine may still have the previously modified tracked file. The cleanest recovery will be:

```bash
cd ~/Desktop/carnivore-coach-pro
git fetch origin
git reset --hard origin/main
git clean -fd
npm install
bash scripts/build-android-fresh.sh
```

Important: this discards local uncommitted changes in that folder. Based on the error, the local change is the generated Health Connect plugin copy from the Android build, so this is the right cleanup. If you have any unrelated manual work in that folder, copy it elsewhere first.

## Expected permanent outcome

After this, building Android may still generate or overwrite the plugin inside `android/app/...`, but Git will ignore that generated copy. Future `git pull` should no longer be blocked by the Health Connect plugin file.

For native Android changes, continue using the clean flow:

```bash
git pull
npm install
bash scripts/build-android-fresh.sh
```

No manual edits should be made in `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`; all plugin edits should happen in `native-plugins/android/.../HealthConnectPlugin.kt`.