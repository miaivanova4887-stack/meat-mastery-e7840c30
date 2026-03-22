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
     * Fallback deduplication for overlapping TotalCaloriesBurnedRecord intervals.
     * Used only when no reliable day-cumulative snapshot can be resolved.
     */
    private data class CalorieInterval(
        val startEpoch: Long,
        val endEpoch: Long,
        val kcal: Double,
        val origin: String
    )

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
                val activePermission = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
                val basalPermission = HealthPermission.getReadPermission(BasalMetabolicRateRecord::class)

                if (granted.contains(totalPermission)) {
                    var resolvedTotalKcal: Double? = null
                    var selectedSource = "unresolved"
                    var debugInfo = ""

                    try {
                        val samsungPackage = "com.sec.android.app.shealth"
                        val samsungOriginFilter = setOf(DataOrigin(samsungPackage))

                        val samsungTotalAggregate = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                dataOriginFilter = samsungOriginFilter
                            )
                        )[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0

                        val globalTotalAggregate = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                            )
                        )[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0

                        val samsungActiveAggregate = if (granted.contains(activePermission)) {
                            client.aggregate(
                                AggregateRequest(
                                    metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                    dataOriginFilter = samsungOriginFilter
                                )
                            )[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                        } else {
                            0.0
                        }

                        val globalActiveAggregate = if (granted.contains(activePermission)) {
                            client.aggregate(
                                AggregateRequest(
                                    metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                                )
                            )[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                        } else {
                            0.0
                        }

                        val samsungBasalAggregate = if (granted.contains(basalPermission)) {
                            client.aggregate(
                                AggregateRequest(
                                    metrics = setOf(BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL),
                                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                                    dataOriginFilter = samsungOriginFilter
                                )
                            )[BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                        } else {
                            0.0
                        }

                        val globalBasalAggregate = if (granted.contains(basalPermission)) {
                            client.aggregate(
                                AggregateRequest(
                                    metrics = setOf(BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL),
                                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                                )
                            )[BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL]?.inKilocalories ?: 0.0
                        } else {
                            0.0
                        }

                        val samsungActivePlusBasal = samsungActiveAggregate + samsungBasalAggregate
                        val globalActivePlusBasal = globalActiveAggregate + globalBasalAggregate

                        if (samsungTotalAggregate > 0.0) {
                            resolvedTotalKcal = samsungTotalAggregate
                            selectedSource = "v10_samsung_aggregate_total"
                        } else if (globalTotalAggregate > 0.0) {
                            resolvedTotalKcal = globalTotalAggregate
                            selectedSource = "v10_global_aggregate_total"
                        } else if (samsungActivePlusBasal > 0.0) {
                            resolvedTotalKcal = samsungActivePlusBasal
                            selectedSource = "v10_samsung_active_plus_basal_aggregate"
                        } else if (globalActivePlusBasal > 0.0) {
                            resolvedTotalKcal = globalActivePlusBasal
                            selectedSource = "v10_global_active_plus_basal_aggregate"
                        }

                        // If aggregate paths can't resolve a value, fallback to record-based logic.
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
                            scaledClippedKcal(record, startTime, endTime)
                        }

                        // Build per-record debug dump (first 10 records)
                        val recordDump = allRecords.take(10).mapIndexed { i, r ->
                            "r${i}:[${r.startTime}→${r.endTime} ${String.format("%.1f", r.energy.inKilocalories)}kcal ${r.metadata.dataOrigin.packageName}]"
                        }.joinToString(" ")

                        val samsungRecords = allRecords.filter { 
                            it.metadata.dataOrigin.packageName == samsungPackage 
                        }

                        // Preferred path: use latest day-cumulative snapshot
                        val samsungLatest = latestCumulativeTotal(samsungRecords, startTime, endTime)
                        val globalLatest = latestCumulativeTotal(allRecords, startTime, endTime)

                        // Fallback path: overlap dedup if no cumulative candidates
                        val deduplicatedTotal = deduplicateCalorieRecords(allRecords, startTime, endTime)
                        val samsungDedup = if (samsungRecords.isNotEmpty()) {
                            deduplicateCalorieRecords(samsungRecords, startTime, endTime)
                        } else null

                        if (resolvedTotalKcal == null && samsungLatest != null && samsungLatest.first > 0.0) {
                            resolvedTotalKcal = samsungLatest.first
                            selectedSource = "v10_samsung_latest_total_fallback"
                        } else if (resolvedTotalKcal == null && globalLatest != null && globalLatest.first > 0.0) {
                            resolvedTotalKcal = globalLatest.first
                            selectedSource = "v10_global_latest_total_fallback"
                        } else if (resolvedTotalKcal == null && samsungDedup != null && samsungDedup > 0.0) {
                            resolvedTotalKcal = samsungDedup
                            selectedSource = "v10_samsung_dedup_fallback"
                        } else if (resolvedTotalKcal == null && deduplicatedTotal > 0.0) {
                            resolvedTotalKcal = deduplicatedTotal
                            selectedSource = "v10_global_dedup_fallback"
                        }

                        debugInfo = "requestedStart=$requestedStartRaw requestedEnd=$requestedEndRaw zone=${zone.id} start=$startTime end=$endTime perms(total=${granted.contains(totalPermission)} active=${granted.contains(activePermission)} basal=${granted.contains(basalPermission)}) aggSamsungTotal=${String.format("%.1f", samsungTotalAggregate)} aggGlobalTotal=${String.format("%.1f", globalTotalAggregate)} aggSamsungActive=${String.format("%.1f", samsungActiveAggregate)} aggGlobalActive=${String.format("%.1f", globalActiveAggregate)} aggSamsungBasal=${String.format("%.1f", samsungBasalAggregate)} aggGlobalBasal=${String.format("%.1f", globalBasalAggregate)} origins=${origins.joinToString(";")} recs=$recordCount naiveSum=${String.format("%.1f", naiveSum)} naiveClipped=${String.format("%.1f", naiveClippedSum)} samsungLatest=${String.format("%.1f", samsungLatest?.first ?: 0.0)} globalLatest=${String.format("%.1f", globalLatest?.first ?: 0.0)} samsungDedup=${String.format("%.1f", samsungDedup ?: 0.0)} globalDedup=${String.format("%.1f", deduplicatedTotal)} samsungLatestMeta=${samsungLatest?.second ?: "none"} globalLatestMeta=${globalLatest?.second ?: "none"} samsungRecs=${samsungRecords.size} $recordDump"
                        Log.d(tag, "v10 calorie debug: $debugInfo")
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
                                obj.put("debugSource", "v10_active_fallback")
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