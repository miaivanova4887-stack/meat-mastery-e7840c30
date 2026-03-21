package app.lovable.plugins.healthconnect

import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateRequest
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

    private val tag = "HealthConnectPlugin"
    private var healthConnectClient: HealthConnectClient? = null
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    private var pendingPermissionCall: PluginCall? = null

    private val requiredPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    )

    private val optionalPermissions = setOf(
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    private val requestedPermissions = requiredPermissions + optionalPermissions

    override fun load() {
        super.load()
        try {
            val componentActivity = activity as? androidx.activity.ComponentActivity
            if (componentActivity != null) {
                permissionLauncher = componentActivity.registerForActivityResult(
                    PermissionController.createRequestPermissionResultContract()
                ) { _ ->
                    val call = pendingPermissionCall ?: return@registerForActivityResult
                    pendingPermissionCall = null

                    CoroutineScope(Dispatchers.Main).launch {
                        try {
                            val client = healthConnectClient ?: HealthConnectClient.getOrCreate(context).also {
                                healthConnectClient = it
                            }
                            val latestGranted = client.permissionController.getGrantedPermissions()

                            val result = JSObject()
                            result.put("granted", latestGranted.containsAll(requiredPermissions))
                            result.put("grantedCount", latestGranted.size)
                            call.resolve(result)
                        } catch (e: Exception) {
                            Log.e(tag, "Failed to verify permissions after request", e)
                            call.reject("Permission verification failed: ${e.message}")
                        }
                    }
                }
            } else {
                Log.w(tag, "Activity is not a ComponentActivity — permission launcher unavailable")
            }
        } catch (e: Exception) {
            Log.e(tag, "Failed to register permission launcher", e)
        }
    }

    private fun parseTimeRange(call: PluginCall): Pair<Instant, Instant>? {
        val startTime = call.getString("startTime") ?: run {
            call.reject("startTime is required")
            return null
        }
        val endTime = call.getString("endTime") ?: run {
            call.reject("endTime is required")
            return null
        }

        return try {
            Instant.parse(startTime) to Instant.parse(endTime)
        } catch (e: Exception) {
            call.reject("Invalid time range format: ${e.message}")
            null
        }
    }

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
                    result.put("grantedCount", granted.size)
                    call.resolve(result)
                    return@launch
                }

                val launcher = permissionLauncher
                if (launcher != null) {
                    pendingPermissionCall = call
                    launcher.launch(requestedPermissions)
                } else {
                    Log.w(tag, "Permission launcher unavailable, opening Health Connect settings")
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
                Log.e(tag, "Permission request failed", e)
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
        val (startTime, endTime) = parseTimeRange(call) ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
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
                Log.e(tag, "readSteps failed", e)
                call.reject("Failed to read steps: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readHeartRate(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized")
            return
        }
        val (startTime, endTime) = parseTimeRange(call) ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
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
                Log.e(tag, "readHeartRate failed", e)
                call.reject("Failed to read heart rate: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readWeight(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized")
            return
        }
        val (startTime, endTime) = parseTimeRange(call) ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = WeightRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
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
                Log.e(tag, "readWeight failed", e)
                call.reject("Failed to read weight: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun readActiveCalories(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized")
            return
        }
        val (startTime, endTime) = parseTimeRange(call) ?: return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val records = JSArray()
                val granted = client.permissionController.getGrantedPermissions()
                val totalPermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)

                if (granted.contains(totalPermission)) {
                    // Prefer Samsung Health origin first to avoid mixed-origin double counting.
                    // If unavailable, fall back to all origins.
                    val preferredOrigins = listOf(
                        "com.sec.android.app.shealth"
                    )

                    var resolvedTotalKcal: Double? = null
                    var resolvedSource = ""

                    for (packageName in preferredOrigins) {
                        try {
                            val scopedAggregate = client.aggregate(
                                AggregateRequest(
                                    metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                    dataOriginFilter = setOf(DataOrigin(packageName))
                                )
                            )

                            val scopedTotal = scopedAggregate[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                            if (scopedTotal != null && scopedTotal > 0.0) {
                                resolvedTotalKcal = scopedTotal
                                resolvedSource = packageName
                                break
                            }
                        } catch (e: Exception) {
                            Log.w(tag, "Scoped total calories aggregate failed for $packageName", e)
                        }
                    }

                    if (resolvedTotalKcal == null) {
                        try {
                            val totalAggregate = client.aggregate(
                                AggregateRequest(
                                    metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                                )
                            )
                            val unfilteredTotal = totalAggregate[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                            if (unfilteredTotal != null && unfilteredTotal > 0.0) {
                                resolvedTotalKcal = unfilteredTotal
                                resolvedSource = "all_origins"
                            }
                        } catch (e: Exception) {
                            Log.w(tag, "Total calories aggregate failed", e)
                        }
                    }

                    if (resolvedTotalKcal != null) {
                        val obj = JSObject()
                        obj.put("value", resolvedTotalKcal)
                        obj.put("unit", "kcal")
                        obj.put("timestamp", endTime.toString())
                        records.put(obj)
                        Log.d(tag, "Total calories (aggregate, source=$resolvedSource): $resolvedTotalKcal kcal")
                    }
                }

                // Only fall back to active calories if total aggregate returned nothing
                if (records.length() == 0) {
                    val activePermission = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
                    if (granted.contains(activePermission)) {
                        try {
                            val activeRequest = ReadRecordsRequest(
                                recordType = ActiveCaloriesBurnedRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                            val activeResponse = client.readRecords(activeRequest)
                            for (record in activeResponse.records) {
                                val obj = JSObject()
                                obj.put("value", record.energy.inKilocalories)
                                obj.put("unit", "kcal")
                                obj.put("timestamp", record.endTime.toString())
                                records.put(obj)
                            }
                            Log.d(tag, "Fell back to active calories: ${activeResponse.records.size} records")
                        } catch (e: Exception) {
                            Log.w(tag, "Active calories fallback failed", e)
                        }
                    }
                }

                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(tag, "readActiveCalories unexpected failure", e)
                val fallback = JSObject()
                fallback.put("records", JSArray())
                call.resolve(fallback)
            }
        }
    }
}