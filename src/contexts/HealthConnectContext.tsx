import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import HealthConnect from "@/plugins/HealthConnectPlugin";
import type { HealthConnectRecord } from "@/plugins/HealthConnectPlugin";
import { Capacitor } from "@capacitor/core";

export interface HealthData {
  steps: number;
  heartRate: number;
  weight: number;
  weightUnit: "kg" | "lbs";
  sleep: number;
  activeCalories: number;
}


const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const maxRecordValue = (records: HealthConnectRecord[]): number => {
  return records.reduce((max, record) => {
    const value = toFiniteNumber(record.value);
    return value > max ? value : max;
  }, 0);
};


interface HealthConnectContextType {
  healthData: HealthData;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermissions: () => Promise<void>;
  fetchHealthData: () => Promise<void>;
}

const HealthConnectContext = createContext<HealthConnectContextType | null>(null);

export const useHealthConnectContext = () => {
  const ctx = useContext(HealthConnectContext);
  if (!ctx) throw new Error("useHealthConnectContext must be used within HealthConnectProvider");
  return ctx;
};

const HC_CONNECTED_KEY = "carnivore-hc-connected";

export const HealthConnectProvider = ({ children }: { children: ReactNode }) => {
  const [healthData, setHealthData] = useState<HealthData>({
    steps: 0, heartRate: 0, weight: 0, weightUnit: "lbs", sleep: 0, activeCalories: 0,
  });
  const [isConnected, setIsConnected] = useState(() => {
    try { return localStorage.getItem(HC_CONNECTED_KEY) === "true"; } catch { return false; }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  // Persist connection state
  useEffect(() => {
    try { localStorage.setItem(HC_CONNECTED_KEY, String(isConnected)); } catch {}
  }, [isConnected]);

  const fetchHealthData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const timeRange = { startTime: startOfDay.toISOString(), endTime: now.toISOString() };

      let steps = 0, heartRate = 0, weight = 0, activeCalories = 0;

      try {
        const stepsResult = await HealthConnect.readSteps(timeRange);
        steps = maxRecordValue(stepsResult.records);
      } catch (e) { console.warn("Failed to read steps:", e); }

      try {
        const hrResult = await HealthConnect.readHeartRate(timeRange);
        if (hrResult.records.length > 0) heartRate = toFiniteNumber(hrResult.records[hrResult.records.length - 1].value);
      } catch (e) { console.warn("Failed to read heart rate:", e); }

      // Body weight always in kg (matches Samsung Health source of truth).
      // The cooking-units toggle (imperial/metric) governs ingredients only.
      const weightUnit: "kg" | "lbs" = "kg";

      try {
        // Widen weight window to 365 days — fetch the most recently
        // entered weight, as users may not log weight frequently.
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);
        const weightTimeRange = { startTime: oneYearAgo.toISOString(), endTime: now.toISOString() };
        const weightResult = await HealthConnect.readWeight(weightTimeRange);
        if (weightResult.records.length > 0) {
          // records are returned in chronological order — take the latest
          const kg = toFiniteNumber(weightResult.records[weightResult.records.length - 1].value);
          weight = Math.round(kg * 10) / 10;
        }
      } catch (e) { console.warn("Failed to read weight:", e); }

      try {
        const calResult = await HealthConnect.readActiveCalories(timeRange);
        activeCalories = maxRecordValue(calResult.records);
      } catch (e) { console.warn("Failed to read active calories:", e); }

      setHealthData({
        steps: toFiniteNumber(steps),
        heartRate: toFiniteNumber(heartRate),
        weight: toFiniteNumber(weight),
        weightUnit,
        sleep: 0,
        activeCalories: toFiniteNumber(activeCalories),
      });
    } catch (err: any) {
      console.error("fetchHealthData error:", err);
      setError(`Failed to fetch: ${err?.message || "Unknown error"}`);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!Capacitor.isNativePlatform()) {
      setError("Health sync is only available on mobile devices (iOS or Android).");
      setIsLoading(false);
      return;
    }

    if (!Capacitor.isPluginAvailable("HealthConnect")) {
      setError("Native health module is missing in this build. Rebuild web assets, sync native project, rebuild app, then reinstall.");
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

  // Auto-reconnect on app resume when previously connected
  useEffect(() => {
    if (!isConnected || !Capacitor.isNativePlatform()) return;

    const tryReconnect = async () => {
      try {
        if (!Capacitor.isPluginAvailable("HealthConnect")) return;
        const { status } = await HealthConnect.checkAvailability();
        if (status === "available") {
          await fetchHealthData();
        } else {
          setIsConnected(false);
        }
      } catch {
        // silently fail — will retry on next resume
      }
    };

    // Fetch immediately on mount
    tryReconnect();

    // Listen for app resume (Capacitor App plugin)
    let removeListener: (() => void) | null = null;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("resume", tryReconnect).then((handle) => {
        removeListener = () => handle.remove();
      });
    }).catch(() => {});

    return () => { removeListener?.(); };
  }, [isConnected, fetchHealthData]);

  // Auto-refresh every 5 minutes when connected
  useEffect(() => {
    if (isConnected) {
      intervalRef.current = setInterval(fetchHealthData, 5 * 60 * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, fetchHealthData]);

  return (
    <HealthConnectContext.Provider value={{ healthData, isConnected, isLoading, error, requestPermissions, fetchHealthData }}>
      {children}
    </HealthConnectContext.Provider>
  );
};
