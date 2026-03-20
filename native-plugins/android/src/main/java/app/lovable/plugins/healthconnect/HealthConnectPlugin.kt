package app.lovable.plugins.healthconnect

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val TAG = "HealthConnectPlugin"
    private var healthConnectClient: HealthConnectClient? = null
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    private var pendingPermissionCall: PluginCall? = null

    private val requiredPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    override fun load() {
        super.load()
        try {
            // Register permission launcher on the ComponentActivity (required by AndroidX)
            val componentActivity = activity as? androidx.activity.ComponentActivity
            if (componentActivity != null) {
                permissionLauncher = componentActivity.registerForActivityResult(
                    PermissionController.createRequestPermissionResultContract()
                ) { granted ->
                    val call = pendingPermissionCall ?: return@registerForActivityResult
                    pendingPermissionCall = null
                    val result = JSObject()
                    result.put("granted", granted.containsAll(requiredPermissions))
                    call.resolve(result)
                }
            } else {
                Log.w(TAG, "Activity is not a ComponentActivity — permission launcher unavailable")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register permission launcher", e)
        }
    }

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        try {
            val status = if (Build.VERSION.SDK_INT >= 34) {
                // Android 14+: Health Connect is a platform module, always available
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
                    Log.e(TAG, "Failed to create HealthConnectClient", e)
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
            Log.e(TAG, "checkAvailability failed", e)
            val result = JSObject()
            result.put("status", "unavailable")
            call.resolve(result)
        }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            call.reject("HealthConnect not initialized. Call checkAvailability first.")
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(requiredPermissions)) {
                    val result = JSObject()
                    result.put("granted", true)
                    call.resolve(result)
                    return@launch
                }

                val launcher = permissionLauncher
                if (launcher != null) {
                    pendingPermissionCall = call
                    launcher.launch(requiredPermissions)
                } else {
                    // Fallback: open Health Connect settings directly
                    Log.w(TAG, "Permission launcher unavailable, opening Health Connect settings")
                    try {
                        val settingsIntent = if (Build.VERSION.SDK_INT >= 34) {
                            Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS").apply {
                                putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
                            }
                        } else {
                            Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                        }
                        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(settingsIntent)

                        val result = JSObject()
                        result.put("granted", false)
                        result.put("openedSettings", true)
                        call.resolve(result)
                    } catch (e: Exception) {
                        call.reject("Cannot open Health Connect permissions: ${e.message}")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Permission request failed", e)
                call.reject("Permission request failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readSteps(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized")
            return
        }
        val startTime = call.getString("startTime") ?: run {
            call.reject("startTime is required"); return
        }
        val endTime = call.getString("endTime") ?: run {
            call.reject("endTime is required"); return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(
                        Instant.parse(startTime), Instant.parse(endTime)
                    )
                )
                val response = client.readRecords(request)
                val records = JSArray()
                for (record in response.records) {
                    val obj = JSObject()
                    obj.put("value", record.count)
                    obj.put("unit", "steps")
                    obj.put("timestamp", record.endTime.toString())
                    records.put(obj)
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "readSteps failed", e)
                call.reject("Failed to read steps: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readHeartRate(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized"); return
        }
        val startTime = call.getString("startTime") ?: run {
            call.reject("startTime is required"); return
        }
        val endTime = call.getString("endTime") ?: run {
            call.reject("endTime is required"); return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(
                        Instant.parse(startTime), Instant.parse(endTime)
                    )
                )
                val response = client.readRecords(request)
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
                Log.e(TAG, "readHeartRate failed", e)
                call.reject("Failed to read heart rate: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readWeight(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized"); return
        }
        val startTime = call.getString("startTime") ?: run {
            call.reject("startTime is required"); return
        }
        val endTime = call.getString("endTime") ?: run {
            call.reject("endTime is required"); return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = WeightRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(
                        Instant.parse(startTime), Instant.parse(endTime)
                    )
                )
                val response = client.readRecords(request)
                val records = JSArray()
                for (record in response.records) {
                    val obj = JSObject()
                    obj.put("value", record.weight.inKilograms)
                    obj.put("unit", "kg")
                    obj.put("timestamp", record.time.toString())
                    records.put(obj)
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "readWeight failed", e)
                call.reject("Failed to read weight: ${e.message}")
    @PluginMethod
    fun readActiveCalories(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized"); return
        }
        val startTime = call.getString("startTime") ?: run {
            call.reject("startTime is required"); return
        }
        val endTime = call.getString("endTime") ?: run {
            call.reject("endTime is required"); return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = ActiveCaloriesBurnedRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(
                        Instant.parse(startTime), Instant.parse(endTime)
                    )
                )
                val response = client.readRecords(request)
                val records = JSArray()
                for (record in response.records) {
                    val obj = JSObject()
                    obj.put("value", record.energy.inKilocalories)
                    obj.put("unit", "kcal")
                    obj.put("timestamp", record.endTime.toString())
                    records.put(obj)
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "readActiveCalories failed", e)
                call.reject("Failed to read active calories: ${e.message}")
            }
        }
    }
}
    }
}
