Fix Health Connect weight reading on Android. Scope is limited to weight only — steps, heart rate, and calories code paths are not modified. Three files touched.

## 1. `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt`

**Problem:** Every reader uses `CoroutineScope(Dispatchers.IO).launch { ... }`. This creates an ad-hoc scope with no parent Job tied to the plugin/activity lifecycle. When the bridge thread returns from `readWeight(call)` immediately, the JS-side awaits the resolve, but if the activity goes through any transient state (Health Connect permission UI returning, configuration change, GC of the throwaway scope), the coroutine can be cancelled before `call.resolve(result)` runs — JS then receives an empty/timed-out response. Logcat shows the read succeeded, but JS sees no records.

**Fix:**

- Add a single plugin-scoped `CoroutineScope` tied to the plugin lifecycle:
  ```kotlin
  private val pluginJob = SupervisorJob()
  private val pluginScope = CoroutineScope(Dispatchers.IO + pluginJob)
  ```
- Override `handleOnDestroy()` to cancel `pluginJob` so coroutines are cleaned up with the plugin.
- Replace every `CoroutineScope(Dispatchers.IO).launch { ... }` (in `readSteps`, `readHeartRate`, `readWeight`, `readActiveCalories`) with `pluginScope.launch { ... }`. The two `CoroutineScope(Dispatchers.Main).launch` blocks inside `load()`'s permission callback and inside `requestPermissions` stay on Main but switch to a Main-dispatched scope tied to `pluginJob`: introduce `pluginMainScope = CoroutineScope(Dispatchers.Main + pluginJob)` and use it there.
- Add the missing imports: `kotlinx.coroutines.SupervisorJob`, `kotlinx.coroutines.cancel`.

**Important:** the read logic inside each `launch` block is unchanged. `readWeight` continues to emit `record.weight.inKilograms` with `unit = "kg"`. Only the scope changes.

**Annotation audit:** Confirmed `@PluginMethod` is already present above every public plugin method (`checkAvailability`, `requestPermissions`, `readSteps`, `readHeartRate`, `readWeight`, `readActiveCalories`). No changes needed there — but we'll re-verify after edits.

## 2. `src/contexts/HealthConnectContext.tsx`

The plugin returns weight in kg. Convert to the user's preferred unit on display.

The app already has a unit preference: `localStorage` key `carnivore-unit-system` with values `"imperial" | "metric"`, owned by `ShoppingBagContext`. Reuse that exact key (no new key, no duplicated source of truth) to decide display units.

**Changes inside `fetchHealthData` weight branch only:**

- Keep the existing 30-day weight window and `weightResult.records[last].value` extraction (already kg).
- Read unit preference: `const unitSystem = (localStorage.getItem("carnivore-unit-system") as "imperial" | "metric") || "imperial";`
- If `imperial`, convert kg → lbs (`kg * 2.2046226218`). Round to 1 decimal for both units to keep the dashboard tidy.
- Extend `HealthData` with a new field `weightUnit: "kg" | "lbs"` so the UI can render the correct suffix without re-deriving the preference.
- Update the default `useState<HealthData>` initial value to include `weightUnit: "lbs"` (matches default `imperial`).

No changes to steps/HR/calories paths. No changes to the 5-min auto-refresh, resume listener, or permission flow.

## 3. `src/components/HealthDashboard.tsx`

Render the dynamic unit:

- Read `healthData.weightUnit` and use it for the label currently hardcoded as `"kg"` under the weight tile.
- The numeric tile already uses `formatOneDecimal(safeWeight)` — no other changes.

## 4. Out of scope

- No changes to `readSteps`, `readHeartRate`, `readActiveCalories` logic — only the coroutine scope swap noted above.
- No changes to `HealthConnectPlugin.ts` web bridge interface (the `value`/`unit`/`timestamp` shape is unchanged).
- No iOS, no Health Connect manifest, no build script, no speech-recognition patch.
- No new user-facing settings toggle — we read the existing `carnivore-unit-system` value the user already controls from the Shopping Bag screen.

## 5. Post-edit step

After file edits, run `npx cap sync android` so the Kotlin change is copied into the native project.

## Technical diff sketch

```text
HealthConnectPlugin.kt
  + import kotlinx.coroutines.SupervisorJob
  + import kotlinx.coroutines.cancel
  + private val pluginJob = SupervisorJob()
  + private val pluginScope = CoroutineScope(Dispatchers.IO + pluginJob)
  + private val pluginMainScope = CoroutineScope(Dispatchers.Main + pluginJob)
  + override fun handleOnDestroy() { pluginJob.cancel(); super.handleOnDestroy() }
  ~ CoroutineScope(Dispatchers.IO).launch  -> pluginScope.launch     (4 sites)
  ~ CoroutineScope(Dispatchers.Main).launch -> pluginMainScope.launch (2 sites)

HealthConnectContext.tsx
  + weightUnit: "kg" | "lbs" added to HealthData
  ~ weight branch reads carnivore-unit-system and converts kg->lbs when imperial

HealthDashboard.tsx
  ~ kg label replaced by {healthData.weightUnit}
```

Please take into consideration changes made by Calude 4.6 per below: mia@Marias-MacBook-Pro android % cat app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt

package app.lovable.plugins.healthconnect

&nbsp;

import [android.os.Build](http://android.os.Build)

import android.util.Log

import androidx.activity.result.ActivityResult

import [androidx.health](http://androidx.health).connect.client.HealthConnectClient

import [androidx.health](http://androidx.health).connect.client.PermissionController

import [androidx.health](http://androidx.health).connect.client.permission.HealthPermission

import [androidx.health](http://androidx.health).connect.client.records.HeartRateRecord

import [androidx.health](http://androidx.health).connect.client.records.StepsRecord

import [androidx.health](http://androidx.health).connect.client.records.TotalCaloriesBurnedRecord

import [androidx.health](http://androidx.health).connect.client.records.WeightRecord

import [androidx.health](http://androidx.health).connect.client.request.AggregateRequest

import [androidx.health](http://androidx.health).connect.client.request.ReadRecordsRequest

import [androidx.health](http://androidx.health).connect.client.time.TimeRangeFilter

import com.getcapacitor.JSArray

import com.getcapacitor.JSObject

import com.getcapacitor.Plugin

import com.getcapacitor.PluginCall

import com.getcapacitor.PluginMethod

import com.getcapacitor.annotation.ActivityCallback

import com.getcapacitor.annotation.CapacitorPlugin

import kotlinx.coroutines.CoroutineScope

import kotlinx.coroutines.Dispatchers

import kotlinx.coroutines.launch

import java.time.Instant

&nbsp;

@CapacitorPlugin(name = "HealthConnect")

class HealthConnectPlugin : Plugin() {

&nbsp;

    private val tag = "HealthConnectPlugin"

    private var healthConnectClient: HealthConnectClient? = null

&nbsp;

    private val requiredPermissions = setOf(

        HealthPermission.getReadPermission(StepsRecord::class),

        HealthPermission.getReadPermission(HeartRateRecord::class),

        HealthPermission.getReadPermission(WeightRecord::class),

        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),

    )

&nbsp;

    override fun load() {

        super.load()

    }

&nbsp;

    private fun parseTimeRange(call: PluginCall): Pair<Instant, Instant>? {

        val startTime = call.getString("startTime") ?: run {

            call.reject("startTime is required"); return null

        }

        val endTime = call.getString("endTime") ?: run {

            call.reject("endTime is required"); return null

        }

        return try {

            Instant.parse(startTime) to Instant.parse(endTime)

        } catch (e: Exception) {

            call.reject("Invalid time range format: ${e.message}")

            null

        }

    }

&nbsp;

    private fun sanitizeKcal(value: Double): Double =

        if (value.isNaN() || value.isInfinite() || value < 0.0) 0.0 else value

&nbsp;

    @PluginMethod

    fun checkAvailability(call: PluginCall) {

        try {

            val status = if (Build.VERSION.SDK_INT >= 34) {

                "available"

            } else {

                when (HealthConnectClient.getSdkStatus(context)) {

                    HealthConnectClient.SDK_AVAILABLE -> "available"

                    HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "not_installed"

                    else -> "unavailable"

                }

            }

            if (status == "available") {

                try {

                    healthConnectClient = HealthConnectClient.getOrCreate(context)

                } catch (e: Exception) {

                    Log.e(tag, "Failed to create HealthConnectClient", e)

                    val result = JSObject()

                    result.put("status", "unavailable")

                    call.resolve(result)

                    return

                }

            }

            val result = JSObject()

            result.put("status", status)

            call.resolve(result)

        } catch (e: Exception) {

            Log.e(tag, "checkAvailability failed", e)

            val result = JSObject()

            result.put("status", "unavailable")

            call.resolve(result)

        }

    }

&nbsp;

    @PluginMethod

    override fun requestPermissions(call: PluginCall) {

        val client = healthConnectClient ?: run {

            call.reject("HealthConnect not initialized. Call checkAvailability first.")

            return

        }

        CoroutineScope(Dispatchers.Main).launch {

            try {

                val granted = client.permissionController.getGrantedPermissions()

                if (granted.containsAll(requiredPermissions)) {

                    val result = JSObject()

                    result.put("granted", true)

                    result.put("grantedCount", granted.size)

                    call.resolve(result)

                    return@launch

                }

                val intent = PermissionController

                    .createRequestPermissionResultContract()

                    .createIntent(context, requiredPermissions)

                startActivityForResult(call, intent, "handlePermissionResult")

            } catch (e: Exception) {

                Log.e(tag, "Permission request failed", e)

                call.reject("Permission request failed: ${e.message}")

            }

        }

    }

&nbsp;

    @ActivityCallback

    private fun handlePermissionResult(call: PluginCall?, result: ActivityResult) {

        if (call == null) return

        CoroutineScope(Dispatchers.Main).launch {

            try {

                val client = healthConnectClient ?: HealthConnectClient.getOrCreate(context).also {

                    healthConnectClient = it

                }

                val granted = client.permissionController.getGrantedPermissions()

                val resp = JSObject()

                resp.put("granted", granted.containsAll(requiredPermissions))

                resp.put("grantedCount", granted.size)

                call.resolve(resp)

            } catch (e: Exception) {

                Log.e(tag, "Failed to verify permissions after request", e)

                call.reject("Permission verification failed: ${e.message}")

            }

        }

    }

&nbsp;

    @PluginMethod

    fun readSteps(call: PluginCall) {

        val client = healthConnectClient ?: run {

            call.reject("HealthConnect not initialized"); return

        }

        val (startTime, endTime) = parseTimeRange(call) ?: return

        Log.d(tag, "readWeight called: $startTime -> $endTime")

&nbsp;

        bridge.coroutineScope.launch([Dispatchers.IO](http://Dispatchers.IO)) {

            try {

                // Use global aggregate only — Health Connect deduplicates across

                // all origins including Samsung Health. Per-origin loops cause

                // double-counting when Samsung writes overlapping records.

                val steps = try {

                    client.aggregate(

                        AggregateRequest(

                            metrics = setOf(StepsRecord.COUNT_TOTAL),

                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime),

                        )

                    )[StepsRecord.COUNT_TOTAL] ?: 0L

                } catch (e: Exception) {

                    Log.w(tag, "readSteps aggregate failed", e)

                    0L

                }

&nbsp;

                Log.d(tag, "readSteps: $steps for $startTime -> $endTime")

&nbsp;

                val records = JSArray()

                val obj = JSObject()

                obj.put("value", steps)

                obj.put("unit", "steps")

                obj.put("timestamp", endTime.toString())

                records.put(obj)

&nbsp;

                val result = JSObject()

                result.put("records", records)

                call.resolve(result)

            } catch (e: Exception) {

                Log.e(tag, "readSteps failed", e)

                call.reject("Failed to read steps: ${e.message}")

            }

        }

    }

&nbsp;

    @PluginMethod

    fun readHeartRate(call: PluginCall) {

        val client = healthConnectClient ?: run {

            call.reject("HealthConnect not initialized"); return

        }

        val (startTime, endTime) = parseTimeRange(call) ?: return

        Log.d(tag, "readWeight called: $startTime -> $endTime")

&nbsp;

        bridge.coroutineScope.launch([Dispatchers.IO](http://Dispatchers.IO)) {

            try {

                val response = client.readRecords(

                    ReadRecordsRequest(

                        recordType = HeartRateRecord::class,

                        timeRangeFilter = TimeRangeFilter.between(startTime, endTime)

                    )

                )

                val records = JSArray()

                for (record in response.records) {

                    for (sample in record.samples) {

                        val obj = JSObject()

                        obj.put("value", sample.beatsPerMinute)

                        obj.put("unit", "bpm")

                        obj.put("timestamp", sample.time.toString())

                        records.put(obj)

                    }

                }

                val result = JSObject()

                result.put("records", records)

                call.resolve(result)

            } catch (e: Exception) {

                Log.e(tag, "readHeartRate failed", e)

                call.reject("Failed to read heart rate: ${e.message}")

            }

        }

    }

&nbsp;

    @PluginMethod

    fun readWeight(call: PluginCall) {

        val client = healthConnectClient ?: run {

            call.reject("HealthConnect not initialized"); return

        }

        val (startTime, endTime) = parseTimeRange(call) ?: return

        Log.d(tag, "readWeight called: $startTime -> $endTime")

&nbsp;

        bridge.coroutineScope.launch([Dispatchers.IO](http://Dispatchers.IO)) {

            try {

                var records = readWeightOnce(client, startTime, endTime)

                if (records.isEmpty()) {

                    val widerStarts = listOf(

                        endTime.minusSeconds(60L  *24*  60 * 60),

                        endTime.minusSeconds(180L  *24*  60 * 60),

                        endTime.minusSeconds(365L  *24*  60 * 60),

                    )

                    for (widerStart in widerStarts) {

                        records = readWeightOnce(client, widerStart, endTime)

                        if (records.isNotEmpty()) break

                    }

                }

                val jsRecords = JSArray()

                for (record in records) {

                    val obj = JSObject()

                    obj.put("value", record.weight.inKilograms)

                    obj.put("unit", "kg")

                    obj.put("timestamp", record.time.toString())

                    jsRecords.put(obj)

                }

                val result = JSObject()

                result.put("records", jsRecords)

                call.resolve(result)

            } catch (e: Exception) {

                Log.e(tag, "readWeight failed", e)

                call.reject("Failed to read weight: ${e.message}")

            }

        }

    }

&nbsp;

    private suspend fun readWeightOnce(

        client: HealthConnectClient,

        startTime: Instant,

        endTime: Instant,

    ): List<WeightRecord> {

        return try {

            client.readRecords(

                ReadRecordsRequest(

                    recordType = WeightRecord::class,

                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),

                )

            ).records

        } catch (e: Exception) {

            Log.w(tag, "readWeightOnce failed", e)

            emptyList()

        }

    }

&nbsp;

    @PluginMethod

    fun readActiveCalories(call: PluginCall) {

        val client = healthConnectClient ?: run {

            call.reject("HealthConnect not initialized"); return

        }

        val (startTime, endTime) = parseTimeRange(call) ?: return

        Log.d(tag, "readWeight called: $startTime -> $endTime")

&nbsp;

        bridge.coroutineScope.launch([Dispatchers.IO](http://Dispatchers.IO)) {

            try {

                val granted = client.permissionController.getGrantedPermissions()

                val totalPermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)

                val records = JSArray()

&nbsp;

                if (!granted.contains(totalPermission)) {

                    val result = JSObject()

                    result.put("records", records)

                    call.resolve(result)

                    return@launch

                }

&nbsp;

                // Use global aggregate only — same dedup reason as readSteps

                val kcal = try {

                    val raw = client.aggregate(

                        AggregateRequest(

                            metrics = setOf([TotalCaloriesBurnedRecord.ENERGY](http://TotalCaloriesBurnedRecord.ENERGY)_TOTAL),

                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)

                        )

                    )[[TotalCaloriesBurnedRecord.ENERGY](http://TotalCaloriesBurnedRecord.ENERGY)_TOTAL]?.inKilocalories ?: 0.0

                    sanitizeKcal(raw)

                } catch (e: Exception) {

                    Log.w(tag, "readActiveCalories aggregate failed", e)

                    0.0

                }

&nbsp;

                Log.d(tag, "readActiveCalories: $kcal for $startTime -> $endTime")

&nbsp;

                val obj = JSObject()

                obj.put("value", kcal)

                obj.put("unit", "kcal")

                obj.put("timestamp", endTime.toString())

                records.put(obj)

&nbsp;

                val result = JSObject()

                result.put("records", records)

                call.resolve(result)

            } catch (e: Exception) {

                Log.e(tag, "readActiveCalories failed", e)

                val fallbackRecords = JSArray()

                val obj = JSObject()

                obj.put("value", 0.0)

                obj.put("unit", "kcal")

                obj.put("timestamp", endTime.toString())

                fallbackRecords.put(obj)

                val result = JSObject()

                result.put("records", fallbackRecords)

                call.resolve(result)

            }

        }

    }

}

mia@Marias-MacBook-Pro android % 