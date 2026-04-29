## Diagnosis

### Issue 1 — Health Connect permission prompt never appears

The plugin file is back to its original 499-line shape, identical to the very first commit. The bug is **not in the plugin lifecycle** — it's in the permission API path combined with the dependency version.

Findings:
- `android/app/build.gradle` uses `androidx.health.connect:connect-client:1.1.0-alpha10`.
- The plugin uses `PermissionController.createRequestPermissionResultContract()` from that library.
- On Android **14+ (API 34)** Health Connect is part of the platform, not the standalone "Health Connect" APK. The legacy `createRequestPermissionResultContract()` launcher silently no-ops in that environment because it targets the standalone APK's intent.
- Result: `launcher.launch(requestedPermissions)` returns immediately with no system UI shown, the activity-result callback never fires, and `pendingPermissionCall` stays orphaned. From the user's perspective: "tap Connect, nothing happens."

The fallback path in the plugin (open Health Connect settings) only triggers when `permissionLauncher == null`, which is not the failure case here.

### Issue 2 — Medical disclaimer not visible in Android APK

The disclaimer accordion is correctly present in `src/pages/Index.tsx` (lines 259-269), and `disclaimer.main.title` / `disclaimer.main.body` are populated in both `src/i18n/en.json` and `src/i18n/fr.json`. There is no platform-specific gate around it.

The most likely cause is a stale APK on the device. The repo currently has no built APK output (`android/app/build/outputs/apk/debug/` does not exist), so whatever is installed predates the recent commits. We will add a visible verification stamp tied to disclaimer rendering and instruct a clean reinstall.

---

## Plan

### Step 1 — Patch Health Connect permission flow for API 34+

In both `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` and `native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`:

1. Keep the existing `permissionLauncher` (legacy path, still works for Android 13).
2. In `requestPermissions`, before calling `launcher.launch(...)`, branch on `Build.VERSION.SDK_INT >= 34`:
   - **API 34+**: start an explicit Intent for `android.health.connect.action.REQUEST_HEALTH_PERMISSIONS` with `EXTRA_PACKAGE_NAME = context.packageName` and `EXTRA_PERMISSIONS = arrayOf(... permission strings ...)`. Use `bridge.saveCall(call)` + `startActivityForResult(call, intent, "healthPermissionResult")` so the result fires `@ActivityCallback fun healthPermissionResult(call, result)`.
   - In the callback, re-query `client.permissionController.getGrantedPermissions()` and resolve the JS call with `granted` / `grantedCount`.
   - **API < 34**: keep the existing `permissionLauncher.launch(requestedPermissions)` flow.
3. Keep the existing settings-fallback for the unlikely case both paths fail (`call.reject` instead of falling silent).

This preserves the existing JS-side API (`requestPermissions` resolves with `{ granted, grantedCount }`) so no UI changes are needed.

### Step 2 — Add disclaimer-render assertion to BuildStamp

Tiny non-visible change to confirm the disclaimer accordion item mounted:
- Read the rendered `disclaimer.main.title` from i18n on Index, and append the first 4 chars to `BuildStamp` (e.g. `Build 04-29-1430 · android · D:Medi`).
- This lets the user verify at a glance whether the new bundle is actually installed and whether the i18n key resolved.

### Step 3 — Force-clean rebuild instructions

Provide commands the user runs locally:

```bash
git pull
adb uninstall app.lovable.8cc4469115e240ab844ff90c5fa95cc6 || true
chmod +x scripts/build-android-fresh.sh
bash scripts/build-android-fresh.sh
```

The `adb uninstall` step ensures Android does not keep cached HTML/JS from the previous APK and resets the Health Connect permission grant state for the package (necessary so the new request flow is exercised from a clean state).

---

## Constraints respected
- No changes to React UI (HealthConnectContext, Health screen, accordion layout).
- No refactor to `pluginScope`/`handleOnDestroy` — the `coroutine-pattern` constraint memory is honored.
- No edits to `src/integrations/supabase/*`, `.env`, `supabase/config.toml`.

## Files touched
- `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`
- `native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`
- `src/components/BuildStamp.tsx`
- `src/pages/Index.tsx` (one-line prop/import to surface i18n probe — non-visual)

## Verification after build
1. BuildStamp shows new timestamp + `D:Medi` suffix → bundle is fresh and i18n resolved.
2. Scroll to bottom of Home → "Medical Disclaimer" accordion is present.
3. Open Health screen → tap Connect → Android system permission dialog appears (API 34+) or Health Connect APK dialog appears (API 33-).
4. After granting, app reads steps/weight without further prompts.
