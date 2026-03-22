package app.lovable.plugins.healthconnect

import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
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

    private val samsungOriginPackages = setOf(
        "com.sec.android.app.shealth",
        "com.samsung.android.app.shealth",
        "com.samsung.health",
        "com.samsung.android.health",
    )

    private val requiredPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    )

    private val requestedPermissions = requiredPermissions

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

    private fun isSamsungOrigin(packageName: String?): Boolean {
        if (packageName.isNullOrBlank()) return false
        val normalized = packageName.lowercase()
        return samsungOriginPackages.contains(normalized) ||
            normalized.contains("samsung") ||
            normalized.contains("shealth") ||
            normalized.contains("sec.android")
    }

    private fun defaultSamsungOriginFilter(): Set<DataOrigin> {
        return samsungOriginPackages.map { DataOrigin(it) }.toSet()
    }

    private suspend fun aggregateStepsForOrigin(
        client: HealthConnectClient,
        startTime: Instant,
        endTime: Instant,
        originPackage: String,
    ): Long {
        return try {
            client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    dataOriginFilter = setOf(DataOrigin(originPackage)),
                )
            )[StepsRecord.COUNT_TOTAL] ?: 0L
        } catch (e: Exception) {
            Log.w(tag, "aggregateStepsForOrigin failed for $originPackage", e)
            0L
        }
    }

    private suspend fun aggregateTotalCaloriesForOrigin(
        client: HealthConnectClient,
        startTime: Instant,
        endTime: Instant,
        originPackage: String,
    ): Double {
        return try {
            val value = client.aggregate(
                AggregateRequest(
                    metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    dataOriginFilter = setOf(DataOrigin(originPackage)),
                )
            )[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0
            sanitizeKcal(value)
        } catch (e: Exception) {
            Log.w(tag, "aggregateTotalCaloriesForOrigin failed for $originPackage", e)
            0.0
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
                val hasRequired = granted.containsAll(requiredPermissions)
                val hasAllRequested = granted.containsAll(requestedPermissions)

                if (hasRequired && hasAllRequested) {
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
                val stepsRecordsResponse = try {
                    client.readRecords(
                        ReadRecordsRequest(
                            recordType = StepsRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                        )
                    )
                } catch (e: Exception) {
                    Log.w(tag, "readSteps records fetch failed", e)
                    null
                }

                val detectedSamsungOrigins = stepsRecordsResponse
                    ?.records
                    ?.mapNotNull { it.metadata.dataOrigin.packageName }
                    ?.filter { isSamsungOrigin(it) }
                    ?.toSet()
                    ?: emptySet()

                val samsungOriginsToQuery = if (detectedSamsungOrigins.isNotEmpty()) {
                    detectedSamsungOrigins
                } else {
                    samsungOriginPackages
                }

                var samsungSteps = 0L
                for (originPackage in samsungOriginsToQuery) {
                    val originSteps = aggregateStepsForOrigin(client, startTime, endTime, originPackage)
                    if (originSteps > samsungSteps) samsungSteps = originSteps
                }

                val globalSteps = try {
                    client.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                        )
                    )[StepsRecord.COUNT_TOTAL] ?: 0L
                } catch (e: Exception) {
                    Log.w(tag, "readSteps global aggregate failed", e)
                    0L
                }

                val resolvedSteps = when {
                    samsungSteps > 0L -> samsungSteps
                    globalSteps > 0L -> globalSteps
                    else -> 0L
                }
                val records = JSArray()
                val obj = JSObject()
                obj.put("value", resolvedSteps)
                obj.put("unit", "steps")
                obj.put("timestamp", endTime.toString())
                records.put(obj)

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

    private fun sanitizeKcal(value: Double): Double {
        return if (value.isNaN() || value.isInfinite() || value < 0.0) 0.0 else value
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

                val hasTotalPerm = granted.contains(totalPermission)
                var resolvedTotalKcal = 0.0

                if (!hasTotalPerm) {
                    val result = JSObject()
                    result.put("records", records)
                    call.resolve(result)
                    return@launch
                }

                var aggGlobalTotal = 0.0
                var aggSamsungBestByOrigin = 0.0

                try {
                    val totalCaloriesRecordsResponse = try {
                        client.readRecords(
                            ReadRecordsRequest(
                                recordType = TotalCaloriesBurnedRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                            )
                        )
                    } catch (e: Exception) {
                        Log.w(tag, "readActiveCalories records fetch failed", e)
                        null
                    }

                    val samsungOriginsFromRecords = totalCaloriesRecordsResponse
                        ?.records
                        .mapNotNull { it.metadata.dataOrigin.packageName }
                        .filter { isSamsungOrigin(it) }
                        .toSet()

                    val samsungOriginsToQuery = if (samsungOriginsFromRecords.isNotEmpty()) {
                        samsungOriginsFromRecords
                    } else {
                        samsungOriginPackages
                    }

                    for (originPackage in samsungOriginsToQuery) {
                        val originTotal = aggregateTotalCaloriesForOrigin(client, startTime, endTime, originPackage)
                        if (originTotal > aggSamsungBestByOrigin) aggSamsungBestByOrigin = originTotal
                    }

                    aggGlobalTotal = try {
                        client.aggregate(
                            AggregateRequest(
                                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0
                    } catch (e: Exception) { Log.w(tag, "aggGlobalTotal err", e); 0.0 }
                    aggGlobalTotal = sanitizeKcal(aggGlobalTotal)

                } catch (e: Exception) {
                    Log.w(tag, "Total aggregate block failed", e)
                }

                resolvedTotalKcal = when {
                    aggSamsungBestByOrigin > 0.0 -> aggSamsungBestByOrigin
                    else -> aggGlobalTotal
                }

                resolvedTotalKcal = sanitizeKcal(resolvedTotalKcal)

                val obj = JSObject()
                obj.put("value", resolvedTotalKcal)
                obj.put("unit", "kcal")
                obj.put("timestamp", endTime.toString())
                records.put(obj)

                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(tag, "readActiveCalories unexpected failure", e)
                val crashRecords = JSArray()
                val crashObj = JSObject()
                crashObj.put("value", 0.0)
                crashObj.put("unit", "kcal")
                crashObj.put("timestamp", endTime.toString())
                crashRecords.put(crashObj)
                val fallback = JSObject()
                fallback.put("records", crashRecords)
                call.resolve(fallback)
            }
        }
    }
}