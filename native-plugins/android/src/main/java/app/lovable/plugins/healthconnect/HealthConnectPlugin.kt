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
import java.time.ZoneId

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

    /**
     * Deduplicate overlapping TotalCaloriesBurnedRecord intervals.
     * Samsung Health (and watches) write overlapping time-range records.
     * Health Connect aggregate() sums them naively → inflated totals.
     * 
     * Strategy: sort by startTime, merge overlapping intervals,
     * keep the record with the highest kcal for each merged interval.
     */
    private data class CalorieInterval(
        val startEpoch: Long,
        val endEpoch: Long,
        val kcal: Double,
        val origin: String
    )

    private fun deduplicateCalorieRecords(
        records: List<TotalCaloriesBurnedRecord>,
        queryStart: Instant,
        queryEnd: Instant
    ): Double {
        if (records.isEmpty()) return 0.0

        // Convert to intervals sorted by start time.
        // IMPORTANT: clip each record to the query range and proportionally scale kcal.
        // Samsung can provide records spanning the full day (including future hours),
        // so consuming full record energy inflates "calories so far".
        val intervals = records.mapNotNull { record ->
            val clippedStart = maxOf(record.startTime, queryStart)
            val clippedEnd = minOf(record.endTime, queryEnd)
            if (!clippedEnd.isAfter(clippedStart)) return@mapNotNull null

            val fullDurationSec = (record.endTime.epochSecond - record.startTime.epochSecond).coerceAtLeast(1L)
            val clippedDurationSec = (clippedEnd.epochSecond - clippedStart.epochSecond).coerceAtLeast(0L)
            if (clippedDurationSec == 0L) return@mapNotNull null

            val scaledKcal = record.energy.inKilocalories * (clippedDurationSec.toDouble() / fullDurationSec.toDouble())

            CalorieInterval(
                startEpoch = clippedStart.epochSecond,
                endEpoch = clippedEnd.epochSecond,
                kcal = scaledKcal,
                origin = record.metadata.dataOrigin.packageName
            )
        }.sortedBy { it.startEpoch }

        if (intervals.isEmpty()) return 0.0

        // Merge overlapping intervals: when two intervals overlap,
        // keep the one with higher kcal (it's the more complete measurement)
        val merged = mutableListOf<CalorieInterval>()
        var current = intervals[0]

        for (i in 1 until intervals.size) {
            val next = intervals[i]
            if (next.startEpoch < current.endEpoch) {
                // Overlapping — keep the one with higher kcal value
                // (the more complete measurement)
                current = if (next.kcal > current.kcal) {
                    // Next is better but expand to cover full range
                    CalorieInterval(
                        minOf(current.startEpoch, next.startEpoch),
                        maxOf(current.endEpoch, next.endEpoch),
                        next.kcal,
                        next.origin
                    )
                } else {
                    CalorieInterval(
                        minOf(current.startEpoch, next.startEpoch),
                        maxOf(current.endEpoch, next.endEpoch),
                        current.kcal,
                        current.origin
                    )
                }
            } else {
                // No overlap — commit current and move on
                merged.add(current)
                current = next
            }
        }
        merged.add(current)

        return merged.sumOf { it.kcal }
    }

    @PluginMethod
    fun readActiveCalories(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized")
            return
        }

        val requestedStartRaw = call.getString("startTime") ?: "missing"
        val requestedEndRaw = call.getString("endTime") ?: "missing"
        val zone = ZoneId.systemDefault()
        val endTime = Instant.now()
        val startTime = endTime.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val records = JSArray()
                val granted = client.permissionController.getGrantedPermissions()
                val totalPermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)

                if (granted.contains(totalPermission)) {
                    var resolvedTotalKcal: Double? = null
                    var selectedSource = "unresolved"
                    var debugInfo = ""

                    try {
                        // Read ALL individual TotalCaloriesBurnedRecord entries
                        val totalRecordsResponse = client.readRecords(
                            ReadRecordsRequest(
                                recordType = TotalCaloriesBurnedRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )

                        val allRecords = totalRecordsResponse.records
                        val origins = allRecords
                            .map { it.metadata.dataOrigin.packageName }
                            .filter { it.isNotBlank() }
                            .distinct()

                        val recordCount = allRecords.size
                        val naiveSum = allRecords.sumOf { it.energy.inKilocalories }
                        val naiveClippedSum = allRecords.sumOf { record ->
                            val clippedStart = maxOf(record.startTime, startTime)
                            val clippedEnd = minOf(record.endTime, endTime)
                            if (!clippedEnd.isAfter(clippedStart)) {
                                0.0
                            } else {
                                val fullDurationSec = (record.endTime.epochSecond - record.startTime.epochSecond).coerceAtLeast(1L)
                                val clippedDurationSec = (clippedEnd.epochSecond - clippedStart.epochSecond).coerceAtLeast(0L)
                                record.energy.inKilocalories * (clippedDurationSec.toDouble() / fullDurationSec.toDouble())
                            }
                        }

                        // Build per-record debug dump (first 10 records)
                        val recordDump = allRecords.take(10).mapIndexed { i, r ->
                            "r${i}:[${r.startTime}→${r.endTime} ${String.format("%.1f", r.energy.inKilocalories)}kcal ${r.metadata.dataOrigin.packageName}]"
                        }.joinToString(" ")

                        // DEDUPLICATE overlapping intervals
                        val deduplicatedTotal = deduplicateCalorieRecords(allRecords, startTime, endTime)

                        // Also try Samsung-only dedup
                        val samsungPackage = "com.sec.android.app.shealth"
                        val samsungRecords = allRecords.filter { 
                            it.metadata.dataOrigin.packageName == samsungPackage 
                        }
                        val samsungDedup = if (samsungRecords.isNotEmpty()) {
                            deduplicateCalorieRecords(samsungRecords, startTime, endTime)
                        } else null

                        // Prefer Samsung-only dedup, then global dedup
                        if (samsungDedup != null && samsungDedup > 0.0) {
                            resolvedTotalKcal = samsungDedup
                            selectedSource = "v8_samsung_dedup_clipped"
                        } else if (deduplicatedTotal > 0.0) {
                            resolvedTotalKcal = deduplicatedTotal
                            selectedSource = "v8_global_dedup_clipped"
                        }

                        debugInfo = "zone=${zone.id} start=$startTime end=$endTime origins=${origins.joinToString(";")} recs=$recordCount naiveSum=${String.format("%.1f", naiveSum)} naiveClipped=${String.format("%.1f", naiveClippedSum)} samsungDedup=${String.format("%.1f", samsungDedup ?: 0.0)} globalDedup=${String.format("%.1f", deduplicatedTotal)} samsungRecs=${samsungRecords.size} $recordDump"
                        Log.d(tag, "v8 calorie debug: $debugInfo")
                    } catch (e: Exception) {
                        Log.w(tag, "Total calories resolution failed", e)
                        debugInfo = "error: ${e.message}"
                    }

                    if (resolvedTotalKcal != null && resolvedTotalKcal > 0.0) {
                        val obj = JSObject()
                        obj.put("value", resolvedTotalKcal)
                        obj.put("unit", "kcal")
                        obj.put("timestamp", endTime.toString())
                        obj.put("debugSource", selectedSource)
                        obj.put("debugOrigins", debugInfo)
                        records.put(obj)
                    }
                }

                // Fallback to ActiveCaloriesBurnedRecord
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
                                 obj.put("debugSource", "v8_active_fallback")
                                obj.put("debugOrigins", "activeRecords=${activeResponse.records.size}")
                                records.put(obj)
                            }
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