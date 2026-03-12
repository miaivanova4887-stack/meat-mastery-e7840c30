import { useState, useCallback } from "react";
import HealthConnect from "@/plugins/HealthConnectPlugin";
import type { HealthConnectRecord } from "@/plugins/HealthConnectPlugin";
import { Capacitor } from "@capacitor/core";

export interface HealthData {
  steps: number;
  heartRate: number;
  weight: number;
  sleep: number;
}

export const useHealthConnect = () => {
  const [healthData, setHealthData] = useState<HealthData>({
    steps: 0,
    heartRate: 0,
    weight: 0,
    sleep: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const timeRange = {
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      };

      let steps = 0;
      let heartRate = 0;
      let weight = 0;

      try {
        const stepsResult = await HealthConnect.readSteps(timeRange);
        steps = stepsResult.records.reduce((sum: number, r: HealthConnectRecord) => sum + r.value, 0);
      } catch (e) {
        console.warn("Failed to read steps:", e);
      }

      try {
        const hrResult = await HealthConnect.readHeartRate(timeRange);
        if (hrResult.records.length > 0) {
          heartRate = hrResult.records[hrResult.records.length - 1].value;
        }
      } catch (e) {
        console.warn("Failed to read heart rate:", e);
      }

      try {
        const weightResult = await HealthConnect.readWeight(timeRange);
        if (weightResult.records.length > 0) {
          weight = weightResult.records[weightResult.records.length - 1].value;
        }
      } catch (e) {
        console.warn("Failed to read weight:", e);
      }

      setHealthData({ steps, heartRate, weight, sleep: 0 });
    } catch (err: any) {
      console.error("fetchHealthData error:", err);
      setError(`Failed to fetch: ${err?.message || "Unknown error"}`);
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!Capacitor.isNativePlatform()) {
      setError("Health Connect is only available on Android devices.");
      setIsLoading(false);
      return;
    }

    try {
      const { status } = await HealthConnect.checkAvailability();
      if (status !== "available") {
        setError(
          status === "not_installed"
            ? "Health Connect app is not installed. Please install it from the Play Store."
            : "Health Connect is not available on this device."
        );
        setIsLoading(false);
        return;
      }

      const { granted } = await HealthConnect.requestPermissions();
      if (!granted) {
        setError("Health Connect permissions were denied.");
        setIsLoading(false);
        return;
      }

      setIsConnected(true);
      await fetchHealthData();
    } catch (err: any) {
      setError(`Connection error: ${err?.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchHealthData]);

  return {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  };
};
