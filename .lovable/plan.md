## Updated diagnosis

I compared the file you uploaded against the repo:

| Source | Lines | Pattern | Status |
|---|---|---|---|
| Your Mac (uploaded) | 500 | `CoroutineScope(Dispatchers.IO).launch` ad-hoc | **Stale, pre-fix** |
| `native-plugins/.../HealthConnectPlugin.kt` | 499 | `CoroutineScope(Dispatchers.IO).launch` ad-hoc | **Stale, pre-fix** |
| `android/app/.../HealthConnectPlugin.kt` (in Lovable repo) | 544 | `pluginScope` + `pluginMainScope` + `handleOnDestroy()` | **Fixed** |

Two important facts:

1. **The file you uploaded does not contain `coroutineScope` anywhere** (lowercase or otherwise). The compile error you pasted (`Unresolved reference 'coroutineScope'` at 152/196/232/290) cannot have come from this file — those line numbers contain `Log.w(...)`, `if (client == null)`, `val result = JSObject()`, and `AggregateRequest(`. So either the error was from a different (further-edited) version, or Gradle compiled a cached source. Doesn't change the fix.

2. **`scripts/build-android-fresh.sh` always overwrites `android/app/.../HealthConnectPlugin.kt` with `native-plugins/.../HealthConnectPlugin.kt`**:

   ```bash
   cp "$PLUGIN_SRC" "$PLUGIN_DEST_DIR/HealthConnectPlugin.kt"
   # PLUGIN_SRC = native-plugins/android/.../HealthConnectPlugin.kt
   ```

   So even though the repo's `android/app/...` copy is correct, **every time you run the build script it replaces the good file with the stale `native-plugins/` copy**. That's why the weight fix from last turn never actually lands in the APK.

## What I will change

### Sync `native-plugins/.../HealthConnectPlugin.kt` to match the fixed file

Overwrite `native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` with the exact contents of `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` (the 544-line file with `pluginJob`, `pluginScope`, `pluginMainScope`, and `handleOnDestroy()`).

After that, both files in the repo are byte-identical and contain the lifecycle-aware coroutine scope fix. The build script's `cp` step becomes a no-op rather than a regression.

### Nothing else

- No change to `android/app/.../HealthConnectPlugin.kt` (already correct).
- No change to `src/contexts/HealthConnectContext.tsx` (already correct).
- No change to `scripts/build-android-fresh.sh`.
- No change to the speech-recognition patch or anything unrelated.

## What you do on your Mac afterward

```bash
git pull
# Force your Mac's stale local file to be replaced with the synced repo version:
git checkout -- android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
git checkout -- native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt
npm install
./scripts/build-android-fresh.sh
```

The two `git checkout --` lines are essential. Your local copies are tracked files with local modifications, so `git pull` won't touch them. Discarding local edits forces the fixed versions into your working tree. Then the build script's `cp` step copies the correct `native-plugins/` source into `android/app/...`, Kotlin compiles cleanly, and the lifecycle-aware coroutine fix actually ships in the APK.

## Verification you can do after the build

Inside the built APK, the plugin should contain:

```kotlin
private val pluginJob = SupervisorJob()
private val pluginScope = CoroutineScope(Dispatchers.IO + pluginJob)
private val pluginMainScope = CoroutineScope(Dispatchers.Main + pluginJob)

override fun handleOnDestroy() {
    pluginJob.cancel()
    super.handleOnDestroy()
}
```

If you grep your local `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` for `pluginScope` after the build script runs and it returns matches, the fix is in.
