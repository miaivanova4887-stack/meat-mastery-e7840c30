//
//  HealthConnectPlugin.swift
//  CarnivoreX
//
//  iOS HealthKit bridge that matches the Android HealthConnect plugin contract.
//  Registered as "HealthConnect" so the existing TypeScript bridge
//  (src/plugins/HealthConnectPlugin.ts) works cross-platform without changes.
//
//  JS → Capacitor method → HealthKit
//    checkAvailability   → HKHealthStore.isHealthDataAvailable()
//    requestPermissions  → HKHealthStore.requestAuthorization(toShare:read:)
//    readSteps           → HKStatisticsQuery .cumulativeSum (total over range)
//    readHeartRate       → HKSampleQuery per-sample (bpm)
//    readWeight          → HKSampleQuery per-sample (kg)
//    readActiveCalories  → HKStatisticsQuery .cumulativeSum (total over range, kcal)
//
//  Return shape matches Android exactly:
//    { records: [ { value: Number, unit: String, timestamp: ISO8601 } ] }
//
//  Aggregation semantics (must match Android):
//    - steps:    single record, value = sum, timestamp = endTime
//    - heart:    array of raw samples
//    - weight:   array of raw samples
//    - calories: single record, value = sum, timestamp = endTime
//

import Foundation
import Capacitor
import HealthKit

@objc(HealthConnectPlugin)
public class HealthConnectPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthConnectPlugin"
    public let jsName = "HealthConnect"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAvailability",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSteps",          returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readHeartRate",      returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readWeight",         returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readActiveCalories", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    // MARK: - HealthKit types we read

    private var readTypes: Set<HKObjectType> {
        var set = Set<HKObjectType>()
        if let t = HKObjectType.quantityType(forIdentifier: .stepCount)          { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .heartRate)           { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .bodyMass)            { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)  { set.insert(t) }
        return set
    }

    // MARK: - checkAvailability

    @objc func checkAvailability(_ call: CAPPluginCall) {
        let available = HKHealthStore.isHealthDataAvailable()
        // HealthKit has no "not_installed" state the way Android does; it's just
        // "available" on iPhones, "unavailable" on iPad (mostly) and Simulator reads.
        call.resolve(["status": available ? "available" : "unavailable"])
    }

    // MARK: - requestPermissions

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available on this device")
            return
        }
        healthStore.requestAuthorization(toShare: nil, read: readTypes) { [weak self] success, error in
            if let error = error {
                call.reject("HealthKit authorization error: \(error.localizedDescription)")
                return
            }
            // NOTE: iOS does NOT tell you whether read permissions were granted
            // (privacy design — you can't distinguish "denied" from "no data").
            // `success` only means the sheet was shown without error.
            // We return granted:true if the dialog flow completed; the app must
            // handle empty reads gracefully, just like on Android when a user
            // toggles a specific metric off.
            let grantedCount = self?.readTypes.count ?? 0
            call.resolve([
                "granted": success,
                "grantedCount": grantedCount
            ])
        }
    }

    // MARK: - readSteps (total sum over range)

    @objc func readSteps(_ call: CAPPluginCall) {
        guard let (start, end) = parseTimeRange(call) else { return }
        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            call.reject("stepCount type unavailable")
            return
        }
        sumQuantity(
            type: stepType,
            unit: HKUnit.count(),
            start: start,
            end: end,
            unitLabel: "steps",
            integer: true,
            call: call
        )
    }

    // MARK: - readHeartRate (per-sample)

    @objc func readHeartRate(_ call: CAPPluginCall) {
        guard let (start, end) = parseTimeRange(call) else { return }
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            call.reject("heartRate type unavailable")
            return
        }
        sampleQuantity(
            type: hrType,
            unit: HKUnit.count().unitDivided(by: .minute()),
            start: start,
            end: end,
            unitLabel: "bpm",
            integer: true,
            call: call
        )
    }

    // MARK: - readWeight (per-sample, kg)

    @objc func readWeight(_ call: CAPPluginCall) {
        guard let (start, end) = parseTimeRange(call) else { return }
        guard let bmType = HKObjectType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("bodyMass type unavailable")
            return
        }
        sampleQuantity(
            type: bmType,
            unit: HKUnit.gramUnit(with: .kilo),
            start: start,
            end: end,
            unitLabel: "kg",
            integer: false,
            call: call
        )
    }

    // MARK: - readActiveCalories (total sum, kcal)

    @objc func readActiveCalories(_ call: CAPPluginCall) {
        guard let (start, end) = parseTimeRange(call) else { return }
        guard let kcalType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) else {
            call.reject("activeEnergyBurned type unavailable")
            return
        }
        sumQuantity(
            type: kcalType,
            unit: HKUnit.kilocalorie(),
            start: start,
            end: end,
            unitLabel: "kcal",
            integer: false,
            call: call
        )
    }

    // MARK: - Helpers

    private func parseTimeRange(_ call: CAPPluginCall) -> (Date, Date)? {
        guard let startStr = call.getString("startTime") else {
            call.reject("startTime is required")
            return nil
        }
        guard let endStr = call.getString("endTime") else {
            call.reject("endTime is required")
            return nil
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoNoFrac = ISO8601DateFormatter()
        isoNoFrac.formatOptions = [.withInternetDateTime]

        guard let start = iso.date(from: startStr) ?? isoNoFrac.date(from: startStr),
              let end   = iso.date(from: endStr)   ?? isoNoFrac.date(from: endStr) else {
            call.reject("Invalid ISO-8601 time range")
            return nil
        }
        return (start, end)
    }

    /// Runs a cumulativeSum HKStatisticsQuery and returns a single aggregated record,
    /// matching the Android behaviour for steps and active calories.
    private func sumQuantity(
        type: HKQuantityType,
        unit: HKUnit,
        start: Date,
        end: Date,
        unitLabel: String,
        integer: Bool,
        call: CAPPluginCall
    ) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum
        ) { _, stats, error in
            if let error = error {
                call.reject("HealthKit query failed: \(error.localizedDescription)")
                return
            }
            let rawValue = stats?.sumQuantity()?.doubleValue(for: unit) ?? 0
            let value: Any = integer ? Int(rawValue.rounded()) : rawValue
            let record: [String: Any] = [
                "value": value,
                "unit": unitLabel,
                "timestamp": Self.iso8601(end)
            ]
            call.resolve(["records": [record]])
        }
        healthStore.execute(query)
    }

    /// Runs HKSampleQuery and returns every sample as an individual record,
    /// matching the Android behaviour for heart rate and weight.
    private func sampleQuantity(
        type: HKQuantityType,
        unit: HKUnit,
        start: Date,
        end: Date,
        unitLabel: String,
        integer: Bool,
        call: CAPPluginCall
    ) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(
            sampleType: type,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [sort]
        ) { _, samples, error in
            if let error = error {
                call.reject("HealthKit sample query failed: \(error.localizedDescription)")
                return
            }
            let records: [[String: Any]] = (samples as? [HKQuantitySample] ?? []).map { sample in
                let raw = sample.quantity.doubleValue(for: unit)
                let value: Any = integer ? Int(raw.rounded()) : raw
                return [
                    "value": value,
                    "unit": unitLabel,
                    "timestamp": Self.iso8601(sample.endDate)
                ]
            }
            call.resolve(["records": records])
        }
        healthStore.execute(query)
    }

    private static func iso8601(_ date: Date) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fmt.string(from: date)
    }
}
