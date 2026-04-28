## Fix Health Connect plugin call lifecycle on Android

### Root cause

`HealthConnectPlugin.requestPermissions()` stores the `PluginCall` in a field (`pendingPermissionCall`) and then launches the system permission controller. The Activity may be paused/recreated while the user is in the Health Connect controller UI, so Capacitor logs:

> Couldn't save last call. Make sure to use `call.setKeepAlive(true)` if you want to retrieve the call later.

Because the call wasn't marked as kept-alive / saved with the bridge, Capacitor can release it before the `registerForActivityResult` callback runs — so the JS-side promise can be lost, and re-checks happen against a discarded call.

The fix is purely a Capacitor lifecycle fix in one Kotlin file. No iOS, no web, no UI changes.

### Changes — `HealthConnectPlugin.kt` only

1. **Save the call before launching the controller**
  - Call `call.setKeepAlive(true)` and `bridge.saveCall(call)` before `launcher.launch(requestedPermissions)`.
  - Store only the call's `callbackId` (string) in `pendingPermissionCallId`, not the `PluginCall` instance itself, so we can retrieve it after the activity returns.
2. **Resolve the saved call in the activity-result callback**
  - In the `registerForActivityResult { _ -> ... }` handler, look up the call via `bridge.getSavedCall(pendingPermissionCallId)`.
  - Re-run `client.permissionController.getGrantedPermissions()`.
  - Resolve (or reject) that saved call with the `granted` boolean + `grantedCount`.
  - After resolving, call `bridge.releaseCall(call)` (or `call.release(bridge)`) and clear `pendingPermissionCallId`.
3. **Symmetric cleanup on launch failure**
  - If `launcher.launch(...)` throws, release the saved call and clear `pendingPermissionCallId` before falling back to the settings-intent path (current settings fallback behaviour preserved).
4. **Defensive guard**
  - If `pendingPermissionCallId` is non-null when `requestPermissions` is invoked again (e.g. user double-taps), reject the new call with a "permission request already in progress" error rather than overwriting the saved call.

### What stays the same

- Manifest, `build.gradle`, `MainActivity.java`, all read methods, the settings-fallback intent, the post-controller `getGrantedPermissions()` re-check semantics, and all JS / web / iOS code.
- The JS contract (`{ granted: boolean, grantedCount?: number, openedSettings?: boolean }`) is unchanged.

### Files touched

- `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` (~25 lines changed across `load()` and `requestPermissions()`, plus one field rename)

### After the fix

- Tapping "Setup" saves the PluginCall with the bridge before the Health Connect UI opens, so Capacitor no longer logs the "Couldn't save last call" warning.
- When the controller returns, the same saved call is resolved with the freshly-checked granted permissions.
- A second "denied" result only appears when the user truly denied; transient activity recreation no longer drops the call.

**Fix the Android Health Connect permission flow in** `HealthConnectPlugin.kt` **only.**  
**The root issue is Capacitor’s saved-call lifecycle: the plugin must call** `call.setKeepAlive(true)` **and** `bridge.saveCall(call)` **before launching the Health Connect permission controller, then recover the call with** `bridge.getSavedCall(pendingPermissionCallId)` **in the activity-result callback, re-check** `getGrantedPermissions()`**, resolve/reject the same saved call, and finally** `bridge.releaseCall(call)` **/** `bridge.releaseCall(callbackId)`**.**  
**Also add a guard so a second permission request is rejected while one is already in progress, and make sure any launch failure releases the saved call before falling back to settings.**  
**Do not change iOS, web UI, Gradle, or the manifest for this step.**