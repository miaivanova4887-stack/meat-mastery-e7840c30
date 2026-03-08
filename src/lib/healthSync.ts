/**
 * Health Sync Utility
 * 
 * This module provides a unified interface for syncing health data
 * from Apple HealthKit (iOS) and Health Connect (Android) via Capacitor plugins.
 * 
 * Required Capacitor plugins (install locally after exporting to GitHub):
 * - @nickymuya/capacitor-health-connect (Android)
 * - @nickymuya/capacitor-healthkit (iOS) 
 * 
 * Usage:
 * 1. Export project to GitHub
 * 2. npm install
 * 3. npm install @nickymuya/capacitor-health-connect @nickymuya/capacitor-healthkit
 * 4. npx cap add android / npx cap add ios
 * 5. npx cap sync
 * 6. Run on device: npx cap run android / npx cap run ios
 */

import { Capacitor } from "@capacitor/core";

export type HealthMetric = {
  metric: string;
  value: number;
  unit: string;
  recorded_at: string;
  category: string;
};

const METRIC_MAP: Record<string, { category: string; metric: string; unit: string }> = {
  steps: { category: "diet_trends", metric: "steps", unit: "steps" },
  weight: { category: "body_measurements", metric: "weight", unit: "kg" },
  heart_rate: { category: "vitals", metric: "heart_rate", unit: "bpm" },
  blood_pressure_systolic: { category: "vitals", metric: "bp_systolic", unit: "mmHg" },
  blood_pressure_diastolic: { category: "vitals", metric: "bp_diastolic", unit: "mmHg" },
  blood_glucose: { category: "vitals", metric: "blood_glucose", unit: "mg/dL" },
  sleep_duration: { category: "mood", metric: "sleep_quality", unit: "hours" },
};

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): "ios" | "android" | "web" {
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}

/**
 * Request health permissions. Must be called before reading data.
 * This is a stub — actual implementation requires the native plugins.
 */
export async function requestHealthPermissions(): Promise<boolean> {
  if (!isNativePlatform()) {
    console.warn("Health sync is only available on native platforms (iOS/Android).");
    return false;
  }

  const platform = getPlatform();
  
  try {
    if (platform === "ios") {
      // const { CapacitorHealthkit } = await import("@nickymuya/capacitor-healthkit");
      // await CapacitorHealthkit.requestAuthorization({ ... });
      console.log("HealthKit authorization would be requested here");
    } else if (platform === "android") {
      // const { HealthConnect } = await import("@nickymuya/capacitor-health-connect");
      // await HealthConnect.requestPermissions({ ... });
      console.log("Health Connect authorization would be requested here");
    }
    return true;
  } catch (e) {
    console.error("Failed to request health permissions:", e);
    return false;
  }
}

/**
 * Read health data from device for a given date range.
 * Returns normalized HealthMetric array ready to insert into progress_entries.
 */
export async function readHealthData(
  _startDate: Date,
  _endDate: Date
): Promise<HealthMetric[]> {
  if (!isNativePlatform()) {
    return [];
  }

  // Stub: In native build, this would use the platform-specific plugin
  // to read steps, weight, heart rate, blood pressure, etc.
  // and normalize them into HealthMetric format using METRIC_MAP
  
  return [];
}

export { METRIC_MAP };
