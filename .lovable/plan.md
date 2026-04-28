## Activate Health Connect on Android (runtime permissions)

### Root cause of "permissions denied"

The Kotlin plugin (`HealthConnectPlugin.kt`) is fully written, but three things prevent it from ever showing the permission UI:

1. It is **not registered** in `MainActivity.java` — Capacitor never instantiates it, so JS calls fall through to the web fallback (`granted: false`).
2. `android/app/build.gradle` is **missing the Health Connect + activity-ktx dependencies**, so even if registered, the module would not compile / would runtime-crash on `HealthConnectClient.getOrCreate(...)`.
3. `AndroidManifest.xml` declares **none** of the `android.permission.health.*` permissions, no `<queries>` for the Health Connect package, and no rationale intent-filter — so Android refuses to launch the permission controller and instantly returns "denied".

iOS files and all web/UI code stay untouched.

### Changes

**1. `android/app/build.gradle`** — add dependencies
```
implementation "androidx.health.connect:connect-client:1.1.0-alpha10"
implementation "androidx.activity:activity-ktx:1.9.3"
```
Also add `kotlin-android` plugin apply line (Capacitor's android template usually includes Kotlin already via `capacitor.build.gradle`; verify and only add if missing — the existing `.kt` plugin file proves Kotlin already compiles in this project, so likely no change needed here).

**2. `android/app/src/main/AndroidManifest.xml`** — add:
- Top-level permissions:
  ```
  <uses-permission android:name="android.permission.health.READ_STEPS"/>
  <uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
  <uses-permission android:name="android.permission.health.READ_WEIGHT"/>
  <uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED"/>
  <uses-permission android:name="android.permission.health.READ_TOTAL_CALORIES_BURNED"/>
  ```
- `<queries><package android:name="com.google.android.apps.healthdata"/></queries>` (pre-API 34 visibility)
- Rationale intent-filter on `MainActivity` (required so Health Connect can call back into the app to show the privacy policy/rationale):
  ```
  <intent-filter>
    <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
  </intent-filter>
  ```
- Android 14 rationale activity-alias:
  ```
  <activity-alias
      android:name="ViewPermissionUsageActivity"
      android:exported="true"
      android:targetActivity=".MainActivity"
      android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
    <intent-filter>
      <action android:name="android.intent.action.VIEW_PERMISSION_USAGE"/>
      <category android:name="android.intent.category.HEALTH_PERMISSIONS"/>
    </intent-filter>
  </activity-alias>
  ```

**3. `android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java`** — register the plugin:
```java
package com.mi4labs.carnivorex;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.lovable.plugins.healthconnect.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthConnectPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
```

**4. `HealthConnectPlugin.kt`** — small hardening so the settings-fallback also fires when `launcher.launch(...)` itself throws (e.g. ActivityNotFoundException on misconfigured devices). Wrap the `launcher.launch(requestedPermissions)` call in try/catch; on failure, run the same `MANAGE_HEALTH_PERMISSIONS` / `ACTION_HEALTH_CONNECT_SETTINGS` intent path that already exists, and resolve with `{ granted: false, openedSettings: true }` instead of rejecting. The existing `getGrantedPermissions()` re-check (lines 64–80, 201–212) already correctly distinguishes "really denied" from "granted", so no change to the success path.

### Files touched
- `android/app/build.gradle` (+2 lines)
- `android/app/src/main/AndroidManifest.xml` (+~25 lines)
- `android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java` (rewrite, ~10 lines)
- `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` (small try/catch around `launcher.launch`)

### Not touched
- All `ios/**` files
- All `src/**` web/UI code (the JS bridge, `HealthConnectContext`, `HealthDashboard` already call the plugin correctly)
- Capacitor config, build scripts, gradle versions

### After the change
- User taps "Setup" → `checkAvailability` returns `available` → `requestPermissions` calls `getGrantedPermissions()`; if missing, launches the system Health Connect permission controller.
- After the controller returns, the plugin re-reads `getGrantedPermissions()` and only reports `granted: false` when the user truly denied.
- If the controller cannot launch (older OEM, missing HC app on API ≥ 34, ActivityNotFound), the fallback opens `MANAGE_HEALTH_PERMISSIONS` / `ACTION_HEALTH_CONNECT_SETTINGS` so the user can grant manually.
- User must run `./gradlew assembleDebug` (or `scripts/build-android-fresh.sh`) to install the rebuilt APK — the JS bridge alone cannot pick up native manifest/dependency changes.