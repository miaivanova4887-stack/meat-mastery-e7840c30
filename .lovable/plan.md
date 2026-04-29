I found two concrete problems behind the repeated lbs/kg issue.

Do I know what the issue is? Yes.

1. The installed app is still running stale weight code: your logcat shows `readWeight` being called with a 30-day window:

```text
"startTime":"2026-03-30..."
```

The latest intended JS fix should send a 365-day window. So the current APK is not executing the fixed JS bundle.

2. The Android build script copies the native plugin from:

```text
native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
```

into:

```text
android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
```

after `npx cap sync android`. The copied source is still the older version: it does not include the 365-day weight safety window and does not include the `readWeight` diagnostic log. That explains why your grep only shows the Capacitor bridge call, not the expected `readWeight: ... records, origins=...` line.

There is also a third issue in the log:

```text
requires android.permission.GRANT_RUNTIME_PERMISSIONS
```

The app is trying to manually launch Android 14's platform Health Connect permission activity. Official Health Connect docs show the correct approach is the Health Connect permission result contract (`PermissionController.createRequestPermissionResultContract()`), not manually starting `android.health.connect.action.REQUEST_HEALTH_PERMISSIONS`. The manual path is what triggers this Samsung/Android security exception.

Plan to fix it:

1. Make kilograms the only Health Connect body-weight unit in the React layer
  - Change initial `HealthConnectContext` state from `weightUnit: "lbs"` to `"kg"`.
  - Narrow the app's synced-weight type so Health Connect weight cannot present as lbs.
  - Keep recipe/shopping imperial settings separate; they must not affect health body weight.
2. Add defensive weight normalization
  - When reading records from the native plugin, trust `unit: "kg"`.
  - If any future/native/web fallback ever returns `lb`/`lbs`, convert it back to kg before storing/displaying. -- no, use units per user entry in Samsung Health
  - Ensure Homepage, Progress, and Health Sync all render the same value and label.
3. Fix the real native source of truth
  - Update both native plugin copies, especially `native-plugins/android/.../HealthConnectPlugin.kt`, because the build script copies from there.
  - Keep `android/app/.../HealthConnectPlugin.kt` in sync so local inspection and Android Studio both show the same code.
4. Add the requested origin confirmation in logcat
  - In `readWeight`, sort records by timestamp and log the latest record as:

```text
HealthConnectPlugin: readWeight latest: valueKg=55.1, unit=kg, time=..., origin=com.sec.android.app.shealth, isSamsungOrigin=true
```

- Also log record count and all package origins, for example:

```text
HealthConnectPlugin: readWeight: 3 records, origins=[com.sec.android.app.shealth], window=...
```

5. Widen native weight lookup to 365 days regardless of JS input
  - Even if old JS passes a 30-day range, native Kotlin will force the lookup back to 365 days.
  - This prevents weight from disappearing when the user has not logged weight recently.
6. Fix Health Connect permission request flow
  - Remove the manual Android 14 `REQUEST_HEALTH_PERMISSIONS` intent branch that causes the `GRANT_RUNTIME_PERMISSIONS` denial.
  - Use the official Health Connect permission contract consistently.
  - Keep the fallback to open Health Connect settings only when the permission launcher is unavailable.
7. Harden the Android build script against stale native code
  - After copying the plugin from `native-plugins`, verify the destination file contains the new diagnostic marker (`readWeight latest`) and 365-day safety logic.
  - If not, fail the build with a clear message instead of producing another APK with stale code.
8. Add a visible/debuggable build fingerprint for this fix
  - Log from JS when fetching weight so it is obvious the installed web bundle is the kg-only build.
  - This makes it much easier to prove the phone is not running cached assets.

After approval, I will implement these changes. Then your verification command should show the actual latest weight origin:

```bash
adb logcat -c
adb logcat | grep -E "HealthConnectPlugin|readWeight|HealthConnectContext"
```

Expected result after the fix:

```text
HealthConnectPlugin: readWeight latest: valueKg=55.1, unit=kg, origin=com.sec.android.app.shealth, isSamsungOrigin=true
```

Recommended reinstall sequence after the patch lands:

```bash
cd ~/Desktop/carnivore-coach-pro
git pull
npm install
adb uninstall com.mi4labs.carnivorex 2>/dev/null || true
rm -rf dist android/.gradle android/app/build android/app/src/main/assets/public
bash scripts/build-android-fresh.sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Then reopen the app and reconnect Health Connect if Android asks.

View HistoryTroubleshooting docs

**Fix the remaining weight issues without forcing kilograms. The app should read the latest Samsung Health weight record from Health Connect, preserve the record’s actual unit, and render the same value and unit consistently on Home, Progress, and Health Sync. Do not hardcode kg or lbs in the React layer; instead, use the unit returned by Health Connect so the app matches the user’s Samsung Health / Health Connect weight setting. Keep the 365-day native lookup, latest-record sorting, and logcat diagnostics. Also keep the Health Connect permission-flow fix that avoids the** `GRANT_RUNTIME_PERMISSIONS` **crash. Do not change unrelated features**