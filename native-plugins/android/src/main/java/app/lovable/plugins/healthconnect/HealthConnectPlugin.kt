package app.lovable.plugins.healthconnect

import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
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
        HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
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

        val requestedStartRaw = call.getString("startTime") ?: "missing"
        val requestedEndRaw = call.getString("endTime") ?: "missing"
        val zone = ZoneId.systemDefault()
        val endTime = Instant.now()
        val samsungDayStartHour = 4
        val startTime = samsungActivityDayStart(endTime, zone, samsungDayStartHour)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val records = JSArray()
                val granted = client.permissionController.getGrantedPermissions()
                val totalPermission = HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
                val activePermission = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
                val basalPermission = HealthPermission.getReadPermission(BasalMetabolicRateRecord::class)

                // v14: ALWAYS return a debug record so we can see what's happening
                val hasTotalPerm = granted.contains(totalPermission)
                val hasActivePerm = granted.contains(activePermission)
                val hasBasalPerm = granted.contains(basalPermission)
                val allGrantedPerms = granted.joinToString(";")

                Log.d(tag, "v15 perms: total=$hasTotalPerm active=$hasActivePerm basal=$hasBasalPerm allGranted=$allGrantedPerms")

                var resolvedTotalKcal: Double? = null
                var selectedSource = "v15_unresolved"
                var debugInfo = "v15 perms(total=$hasTotalPerm active=$hasActivePerm basal=$hasBasalPerm) grantedAll=$allGrantedPerms"

                // ---- AGGREGATE PATH (only if TotalCaloriesBurned permission granted) ----
                var aggSamsungTotal = 0.0
                var aggGlobalTotal = 0.0
                var aggSamsungActive = 0.0
                var aggGlobalActive = 0.0
                var aggSamsungBasal = 0.0
                var aggGlobalBasal = 0.0

                // Wider overlap window helps capture long-running cumulative records
                // that started before local midnight but still overlap today.
                val overlapWindowStart = startTime.minusSeconds(36L * 60L * 60L)
                val overlapWindowEnd = endTime.plusSeconds(12L * 60L * 60L)

                var recordCount = 0
                var naiveSum = 0.0
                var samsungRecCount = 0
                var overlapSamsungLatest = 0.0
                var overlapGlobalLatest = 0.0
                var overlapSamsungDedup = 0.0
                var overlapGlobalDedup = 0.0
                var recordDump = ""

                if (hasTotalPerm) {
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
                }

                if (hasActivePerm) {
                    aggSamsungActive = try {
                        val samsungOriginFilter = setOf(DataOrigin("com.sec.android.app.shealth"))
                        client.aggregate(
                            AggregateRequest(
                                metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                dataOriginFilter = samsungOriginFilter
                            )
                        )[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                    } catch (e: Exception) { Log.w(tag, "aggSamsungActive err", e); 0.0 }
                    aggSamsungActive = sanitizeKcal(aggSamsungActive)

                    aggGlobalActive = try {
                        client.aggregate(
                            AggregateRequest(
                                metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                    } catch (e: Exception) { Log.w(tag, "aggGlobalActive err", e); 0.0 }
                    aggGlobalActive = sanitizeKcal(aggGlobalActive)
                }

                if (hasBasalPerm) {
                    aggSamsungBasal = try {
                        val samsungOriginFilter = setOf(DataOrigin("com.sec.android.app.shealth"))
                        client.aggregate(
                            AggregateRequest(
                                metrics = setOf(BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                dataOriginFilter = samsungOriginFilter
                            )
                        )[BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                    } catch (e: Exception) { Log.w(tag, "aggSamsungBasal err", e); 0.0 }
                    aggSamsungBasal = sanitizeKcal(aggSamsungBasal)

                    aggGlobalBasal = try {
                        client.aggregate(
                            AggregateRequest(
                                metrics = setOf(BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )[BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                    } catch (e: Exception) { Log.w(tag, "aggGlobalBasal err", e); 0.0 }
                    aggGlobalBasal = sanitizeKcal(aggGlobalBasal)
                }

                // ---- OVERLAP RECORD PATH (preferred over aggregate if available) ----
                if (hasTotalPerm) {
                    try {
                        val totalRecordsResponse = client.readRecords(
                            ReadRecordsRequest(
                                recordType = TotalCaloriesBurnedRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(overlapWindowStart, overlapWindowEnd)
                            )
                        )

                        val allRecords = totalRecordsResponse.records
                        recordCount = allRecords.size
                        naiveSum = allRecords.sumOf { it.energy.inKilocalories }

                        val samsungRecords = allRecords.filter {
                            it.metadata.dataOrigin.packageName == "com.sec.android.app.shealth"
                        }
                        samsungRecCount = samsungRecords.size

                        val samsungLatest = latestCumulativeTotal(samsungRecords, startTime, endTime)
                        val globalLatest = latestCumulativeTotal(allRecords, startTime, endTime)

                        overlapSamsungLatest = sanitizeKcal(samsungLatest?.first ?: 0.0)
                        overlapGlobalLatest = sanitizeKcal(globalLatest?.first ?: 0.0)
                        overlapSamsungDedup = sanitizeKcal(deduplicateCalorieRecords(samsungRecords, startTime, endTime))
                        overlapGlobalDedup = sanitizeKcal(deduplicateCalorieRecords(allRecords, startTime, endTime))

                        val uniqueOrigins = allRecords
                            .map { it.metadata.dataOrigin.packageName }
                            .toSet()
                            .take(6)
                            .joinToString(",")

                        recordDump = allRecords.take(4).mapIndexed { i, r ->
                            "r${i}:[${r.startTime}→${r.endTime} ${String.format("%.1f", r.energy.inKilocalories)}kcal ${r.metadata.dataOrigin.packageName}]"
                        }.joinToString(" ") + " origins=$uniqueOrigins"
                    } catch (e: Exception) {
                        Log.w(tag, "Overlap record read failed", e)
                        recordDump = "recordErr:${e.message}"
                    }
                }

                // ---- RESOLVE best value ----
                val samsungActivePlusBasal = aggSamsungActive + aggSamsungBasal
                val globalActivePlusBasal = aggGlobalActive + aggGlobalBasal

                if (overlapSamsungLatest > 0.0) {
                    resolvedTotalKcal = overlapSamsungLatest
                    selectedSource = "v15_samsung_latest_overlap"
                } else if (overlapSamsungDedup > 0.0) {
                    resolvedTotalKcal = overlapSamsungDedup
                    selectedSource = "v15_samsung_dedup_overlap"
                } else if (aggSamsungTotal > 0.0) {
                    resolvedTotalKcal = aggSamsungTotal
                    selectedSource = "v15_samsung_aggregate_total"
                } else if (samsungActivePlusBasal > 0.0) {
                    resolvedTotalKcal = samsungActivePlusBasal
                    selectedSource = "v15_samsung_active_plus_basal"
                } else if (overlapGlobalLatest > 0.0) {
                    resolvedTotalKcal = overlapGlobalLatest
                    selectedSource = "v15_global_latest_overlap"
                } else if (overlapGlobalDedup > 0.0) {
                    resolvedTotalKcal = overlapGlobalDedup
                    selectedSource = "v15_global_dedup_overlap"
                } else if (globalActivePlusBasal > 0.0) {
                    resolvedTotalKcal = globalActivePlusBasal
                    selectedSource = "v15_global_active_plus_basal"
                } else if (aggGlobalTotal > 0.0) {
                    resolvedTotalKcal = aggGlobalTotal
                    selectedSource = "v15_global_aggregate_total"
                }

                // ---- ACTIVE-ONLY FALLBACK ----
                var activeRecCount = 0
                var activeSum = 0.0
                if (resolvedTotalKcal == null && hasActivePerm) {
                    try {
                        val activeResponse = client.readRecords(
                            ReadRecordsRequest(
                                recordType = ActiveCaloriesBurnedRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )
                        activeRecCount = activeResponse.records.size
                        activeSum = activeResponse.records.sumOf { it.energy.inKilocalories }
                        if (activeSum > 0.0) {
                            resolvedTotalKcal = activeSum
                            selectedSource = "v15_active_only_fallback"
                        }
                    } catch (e: Exception) {
                        Log.w(tag, "Active-only fallback failed", e)
                    }
                }

                // ---- BUILD FULL DEBUG STRING ----
                debugInfo = "v15 zone=${zone.id} dayStartHour=$samsungDayStartHour reqStart=$requestedStartRaw reqEnd=$requestedEndRaw start=$startTime end=$endTime " +
                    "perms(total=$hasTotalPerm active=$hasActivePerm basal=$hasBasalPerm) " +
                    "aggST=${String.format("%.1f", aggSamsungTotal)} " +
                    "aggGT=${String.format("%.1f", aggGlobalTotal)} " +
                    "aggSA=${String.format("%.1f", aggSamsungActive)} " +
                    "aggGA=${String.format("%.1f", aggGlobalActive)} " +
                    "aggSB=${String.format("%.1f", aggSamsungBasal)} " +
                    "aggGB=${String.format("%.1f", aggGlobalBasal)} " +
                    "ovST=${String.format("%.1f", overlapSamsungLatest)} " +
                    "ovGT=${String.format("%.1f", overlapGlobalLatest)} " +
                    "ovSD=${String.format("%.1f", overlapSamsungDedup)} " +
                    "ovGD=${String.format("%.1f", overlapGlobalDedup)} " +
                    "ovWin=[${overlapWindowStart}→${overlapWindowEnd}] " +
                    "totalRecs=$recordCount samsungRecs=$samsungRecCount naiveSum=${String.format("%.1f", naiveSum)} " +
                    "activeRecs=$activeRecCount activeSum=${String.format("%.1f", activeSum)} " +
                    "resolved=${String.format("%.1f", resolvedTotalKcal ?: 0.0)} $recordDump"

                val boundedDebugInfo = if (debugInfo.length > 3500) {
                    debugInfo.take(3500) + " …[truncated]"
                } else {
                    debugInfo
                }

                Log.d(tag, "v15 calorie result: source=$selectedSource $boundedDebugInfo")

                // ---- ALWAYS return at least one record with debug info ----
                val obj = JSObject()
                obj.put("value", sanitizeKcal(resolvedTotalKcal ?: 0.0))
                obj.put("unit", "kcal")
                obj.put("timestamp", endTime.toString())
                obj.put("debugSource", selectedSource)
                obj.put("debugOrigins", boundedDebugInfo)
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
                crashObj.put("debugSource", "v15_crash")
                crashObj.put("debugOrigins", "error:${e.message}")
                crashRecords.put(crashObj)
                val fallback = JSObject()
                fallback.put("records", crashRecords)
                call.resolve(fallback)
            }
        }
    }
}