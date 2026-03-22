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
                val samsungOriginFilter = setOf(DataOrigin("com.sec.android.app.shealth"))
                val samsungSteps = try {
                    client.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                            dataOriginFilter = samsungOriginFilter,
                        )
                    )[StepsRecord.COUNT_TOTAL] ?: 0L
                } catch (e: Exception) {
                    Log.w(tag, "readSteps samsung aggregate failed", e)
                    0L
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

                val resolvedSteps = maxOf(samsungSteps, globalSteps, 0L)
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

    /**
     * Fallback deduplication for overlapping TotalCaloriesBurnedRecord intervals.
     * Used only when no reliable day-cumulative snapshot can be resolved.
     */
    private data class CalorieInterval(
        val startEpoch: Long,
        val endEpoch: Long,
        val kcal: Double,
        val origin: String
    )

    private fun sanitizeKcal(value: Double): Double {
        return if (value.isNaN() || value.isInfinite() || value < 0.0) 0.0 else value
    }

    private fun scaledClippedKcal(
        record: TotalCaloriesBurnedRecord,
        queryStart: Instant,
        queryEnd: Instant
    ): Double {
        val clippedStart = maxOf(record.startTime, queryStart)
        val clippedEnd = minOf(record.endTime, queryEnd)
        if (!clippedEnd.isAfter(clippedStart)) return 0.0

        val fullDurationSec = (record.endTime.epochSecond - record.startTime.epochSecond).coerceAtLeast(1L)
        val clippedDurationSec = (clippedEnd.epochSecond - clippedStart.epochSecond).coerceAtLeast(0L)
        if (clippedDurationSec <= 0L) return 0.0

        return record.energy.inKilocalories * (clippedDurationSec.toDouble() / fullDurationSec.toDouble())
    }

    private fun deduplicateCalorieRecords(
        records: List<TotalCaloriesBurnedRecord>,
        queryStart: Instant,
        queryEnd: Instant
    ): Double {
        if (records.isEmpty()) return 0.0

        // Convert to intervals sorted by start time and clip/scale to query range.
        val intervals = records.mapNotNull { record ->
            val clippedStart = maxOf(record.startTime, queryStart)
            val clippedEnd = minOf(record.endTime, queryEnd)
            if (!clippedEnd.isAfter(clippedStart)) return@mapNotNull null

            val scaledKcal = scaledClippedKcal(record, queryStart, queryEnd)
            if (scaledKcal <= 0.0) return@mapNotNull null

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

    /**
     * Samsung often writes day-cumulative "total burned" snapshots
     * (start near midnight, end grows through the day). For this pattern,
     * the latest snapshot best matches Samsung Health UI.
     */
    private fun latestCumulativeTotal(
        records: List<TotalCaloriesBurnedRecord>,
        queryStart: Instant,
        queryEnd: Instant
    ): Pair<Double, String>? {
        if (records.isEmpty()) return null

        val startToleranceSec = 15 * 60L
        val minCoverageSec = 3 * 60 * 60L

        val candidates = records.mapNotNull { record ->
            val clippedStart = maxOf(record.startTime, queryStart)
            val clippedEnd = minOf(record.endTime, queryEnd)
            if (!clippedEnd.isAfter(clippedStart)) return@mapNotNull null

            val startsNearDayStart = !record.startTime.isAfter(queryStart.plusSeconds(startToleranceSec))
            if (!startsNearDayStart) return@mapNotNull null

            val coverageSec = (clippedEnd.epochSecond - queryStart.epochSecond).coerceAtLeast(0L)
            if (coverageSec < minCoverageSec) return@mapNotNull null

            val scaled = scaledClippedKcal(record, queryStart, queryEnd)
            if (scaled <= 0.0) return@mapNotNull null

            Triple(clippedEnd, scaled, record)
        }

        if (candidates.isEmpty()) return null

        val latest = candidates.maxWith(
            compareBy<Triple<Instant, Double, TotalCaloriesBurnedRecord>> { it.first }
                .thenBy { it.second }
        )

        val detail = "start=${latest.third.startTime} end=${latest.third.endTime} scaled=${String.format("%.1f", latest.second)}"
        return latest.second to detail
    }

    /**
     * Samsung Health Daily Activity uses a 4:00 AM local day boundary.
     * Align calorie queries to that boundary so values match Samsung UI.
     */
    private fun samsungActivityDayStart(now: Instant, zone: ZoneId, dayStartHour: Int = 4): Instant {
        val zonedNow = now.atZone(zone)
        var start = zonedNow.toLocalDate().atTime(dayStartHour, 0).atZone(zone)
        if (zonedNow.isBefore(start)) {
            start = start.minusDays(1)
        }
        return start.toInstant()
    }

    @PluginMethod
    fun readActiveCalories(call: PluginCall) {
        val client = healthConnectClient ?: run {
            call.reject("HealthConnect not initialized")
            return
        }

        // Validate incoming call contract (startTime/endTime are required by bridge)
        parseTimeRange(call) ?: return

        val zone = ZoneId.systemDefault()
        val endTime = Instant.now()
        val samsungDayStartHour = 4
        val startTime = samsungActivityDayStart(endTime, zone, samsungDayStartHour)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val records = JSArray()
                val granted = client.permissionController.getGrantedPermissions()
                val totalPermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)

                val hasTotalPerm = granted.contains(totalPermission)
                var resolvedTotalKcal = 0.0
                var selectedSource = "total_unresolved"

                if (!hasTotalPerm) {
                    val result = JSObject()
                    result.put("records", records)
                    call.resolve(result)
                    return@launch
                }

                var aggSamsungTotal = 0.0
                var aggGlobalTotal = 0.0

                // Wider overlap window helps capture long-running cumulative records
                // that started before local midnight but still overlap today.
                val overlapWindowStart = startTime.minusSeconds(36L * 60L * 60L)
                val overlapWindowEnd = endTime.plusSeconds(12L * 60L * 60L)

                var overlapSamsungLatest = 0.0
                var overlapGlobalLatest = 0.0

                try {
                    val samsungPackage = "com.sec.android.app.shealth"
                    val samsungOriginFilter = setOf(DataOrigin(samsungPackage))

                    aggSamsungTotal = try {
                        client.aggregate(
                            AggregateRequest(
                                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                dataOriginFilter = samsungOriginFilter
                            )
                        )[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0
                    } catch (e: Exception) { Log.w(tag, "aggSamsungTotal err", e); 0.0 }
                    aggSamsungTotal = sanitizeKcal(aggSamsungTotal)

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

                try {
                    val totalRecordsResponse = client.readRecords(
                        ReadRecordsRequest(
                            recordType = TotalCaloriesBurnedRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(overlapWindowStart, overlapWindowEnd)
                        )
                    )

                    val allRecords = totalRecordsResponse.records
                    val samsungRecords = allRecords.filter {
                        it.metadata.dataOrigin.packageName == "com.sec.android.app.shealth"
                    }

                    overlapSamsungLatest = sanitizeKcal(latestCumulativeTotal(samsungRecords, startTime, endTime)?.first ?: 0.0)
                    overlapGlobalLatest = sanitizeKcal(latestCumulativeTotal(allRecords, startTime, endTime)?.first ?: 0.0)
                } catch (e: Exception) {
                    Log.w(tag, "Overlap record read failed", e)
                }

                // Resolve using TotalCaloriesBurned only (never Active calories).
                val samsungCandidate = maxOf(overlapSamsungLatest, aggSamsungTotal)
                val globalCandidate = maxOf(overlapGlobalLatest, aggGlobalTotal)

                if (samsungCandidate > 0.0) {
                    // Guard against partial overlap snapshots that are far below aggregate.
                    resolvedTotalKcal = if (
                        overlapSamsungLatest > 0.0 &&
                        aggSamsungTotal > 0.0 &&
                        overlapSamsungLatest < (aggSamsungTotal * 0.6)
                    ) {
                        selectedSource = "total_samsung_aggregate"
                        aggSamsungTotal
                    } else if (overlapSamsungLatest > 0.0) {
                        selectedSource = "total_samsung_latest_overlap"
                        overlapSamsungLatest
                    } else {
                        selectedSource = "total_samsung_aggregate"
                        aggSamsungTotal
                    }
                } else if (globalCandidate > 0.0) {
                    resolvedTotalKcal = if (
                        overlapGlobalLatest > 0.0 &&
                        aggGlobalTotal > 0.0 &&
                        overlapGlobalLatest < (aggGlobalTotal * 0.6)
                    ) {
                        selectedSource = "total_global_aggregate"
                        aggGlobalTotal
                    } else if (overlapGlobalLatest > 0.0) {
                        selectedSource = "total_global_latest_overlap"
                        overlapGlobalLatest
                    } else {
                        selectedSource = "total_global_aggregate"
                        aggGlobalTotal
                    }
                }

                resolvedTotalKcal = sanitizeKcal(resolvedTotalKcal)
                Log.d(tag, "calorie result: source=$selectedSource resolved=${String.format("%.1f", resolvedTotalKcal)}")

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
                // Even on crash, return debug info
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