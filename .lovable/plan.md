## Diagnosis

Kotlin compile fails because `requestPermissions()` in `HealthConnectPlugin.kt` declares `val launcher = permissionLauncher` twice in the same scope (lines 223 and 231). The second block is leftover legacy code from before we unified on `PermissionController.createRequestPermissionResultContract()`.

```kotlin
val launcher = permissionLauncher          // line 223 — primary path
if (launcher != null) { … return@launch }

// API < 34: legacy launcher path
val launcher = permissionLauncher          // line 231 — duplicate, won't compile
if (launcher != null) { … }
else { open Health Connect settings }
```

Kotlin error: "Conflicting declarations: val launcher".

## Fix

Replace the duplicate-declaration block with a single clean implementation:

1. One `val launcher = permissionLauncher` declaration at the top of the permission-request path.
2. If non-null → store `pendingPermissionCall`, launch the contract, return.
3. If null (rare: contract unavailable) → fall back to opening Health Connect settings and resolve `{ granted: false, openedSettings: true }`.

This preserves all current behavior (Samsung Android 14 fix, settings fallback) and removes the dead/duplicate branch.

## Files to change

- `native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` — collapse the two `val launcher` blocks (lines ~223–249) into one.

The build script's `cp` step automatically syncs this fix into `android/app/.../HealthConnectPlugin.kt` on the next build.

## Local re-run

```bash
cd ~/Desktop/carnivore-coach-pro
git fetch origin && git reset --hard origin/main && git clean -fd
npm install
bash scripts/build-android-fresh.sh

Fix the Kotlin compile error in HealthConnectPlugin.kt. The current failure is caused by a duplicate val launcher = permissionLauncher declaration inside requestPermissions() in the same scope, which creates a Kotlin conflicting declaration error. Collapse that code into one clean path: declare val launcher = permissionLauncher once, use it to launch PermissionController.createRequestPermissionResultContract() when available, and fall back to opening Health Connect settings with { granted: false, openedSettings: true } only when the launcher is unavailable. Keep the Samsung Android 14 permission fix, keep the 365-day weight lookup, chronological sorting, and readWeight latest: valueKg=…, origin=…, isSamsungOrigin=… logging. Do not reintroduce the manual REQUEST_HEALTH_PERMISSIONS intent. Make the change in native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt so the build copy stays synced
```