## Diagnosis (corrected)

You're right. I checked the git history of `HealthConnectPlugin.kt`:

| Commit | Date | Content | State |
|---|---|---|---|
| `b4f673a` "Fix origin null-safety" | 2026-03-22 | 499 lines, ad-hoc `CoroutineScope(Dispatchers.IO).launch` | **Last known good** |
| `2e4bdba` "Add iOS + Android Capacitor projects..." | 2026-04-21 | **identical content**, just promoted into `android/app/...` too | **Still good** |
| `6110948` and follow-ups (incl. current `002b3a1`) | 2026-04-28 | 544 lines, rewritten to use `pluginJob` + `pluginScope` + `pluginMainScope` + `handleOnDestroy()` | **Broken — never produced a working APK** |

So the "lifecycle-aware coroutine fix" I kept reinforcing yesterday was the regression. The April 21 / March 22 file (byte-identical, sha256 `37e2674e…`) is what was on disk during the last working build, and matches the file you have locally on your Mac.

The April 28 rewrite is what introduced the `Unresolved reference 'coroutineScope'` family of failures. I will revert the plugin to that proven version.

## What I will change

Restore both copies of the plugin to the April 21 content (commit `2e4bdba`, identical to March 22 `b4f673a`):

- `native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` → 499-line known-good version
- `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` → identical 499-line version

Both will be byte-identical to each other and to what was last shipped. The build script's `cp` step will then be a no-op rather than a regression.

## What I will NOT change

- No UI changes anywhere — the React/TypeScript bridge (`src/plugins/HealthConnectPlugin.ts`) and `src/contexts/HealthConnectContext.tsx` already match the API surface of the 499-line plugin (`checkAvailability`, `requestPermissions`, `readSteps`, `readHeartRate`, `readWeight`, `readActiveCalories`). The visible Health screen, icons, layout, sync flow — all untouched.
- No change to `scripts/build-android-fresh.sh`.
- No change to `AndroidManifest.xml`, `build.gradle`, or the speech-recognition patch.
- No change to iOS or web code.

## Why the original "fix" was wrong

The April 28 rewrite assumed the ad-hoc `CoroutineScope(Dispatchers.IO).launch` blocks were leaking and getting GC'd. In practice the plugin's calls await results via Capacitor's `PluginCall`, which holds the JS-side promise alive — so the coroutines complete fine. Replacing them with a `pluginScope` tied to `handleOnDestroy()` introduced symbol-resolution and lifecycle issues that have prevented the APK from compiling at all.

## After approval — what to run on your Mac

Once Lovable commits the revert, on your Mac:

```bash
cd ~/Desktop/carnivore-coach-pro
git fetch origin
git pull   # if your branch tracks the right remote; otherwise git checkout origin/<branch> -- <paths>
git checkout -- android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
git checkout -- native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt

# Sanity check — both should print 499 and 0
wc -l android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
grep -c "pluginScope\|handleOnDestroy" android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt

npm install
./scripts/build-android-fresh.sh
```

If `git pull` still complains about no upstream, use the explicit form:

```bash
git fetch origin
git checkout origin/legal-region-segregation -- \
  android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt \
  native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
```

(Substitute `main` for `legal-region-segregation` if Lovable is committing to `main`.)

## Memory updates I'll make alongside the revert

Add a constraint memory: "Health Connect Kotlin plugin must use ad-hoc `CoroutineScope(Dispatchers.IO/Main).launch` blocks. Do not rewrite to a `pluginScope` + `handleOnDestroy()` pattern — the April 2026 attempt broke the Android build for 8+ days. Known-good sha256: `37e2674ed361cc8cc6b6c088669272dc52854933354e7c9059d7785d937ea1ad` (499 lines)."

This stops me (or any future agent) from re-doing the same regression.