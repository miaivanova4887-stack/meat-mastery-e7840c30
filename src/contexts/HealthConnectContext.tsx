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

// Versioned key — anything restored from a previous Android Auto Backup
// under the legacy key is intentionally ignored so a fresh install must
// re-prompt for Health Connect.
const HC_CONNECTED_KEY = "carnivore-hc-connected-v2";
const LEGACY_HC_CONNECTED_KEY = "carnivore-hc-connected";

export const HealthConnectProvider = ({ children }: { children: ReactNode }) => {
  const [healthData, setHealthData] = useState<HealthData>({
    // Default to kg because Health Connect's WeightRecord native source is
    // always in kilograms. The actual unit is overwritten on every fetch
    // from the unit string returned by the native plugin.
    steps: 0, heartRate: 0, weight: 0, weightUnit: "kg", sleep: 0, activeCalories: 0,
  });
  const [isConnected, setIsConnected] = useState(() => {
    try {
      // Always purge the legacy key — it may have been restored from
      // a backup of a previous install.
      localStorage.removeItem(LEGACY_HC_CONNECTED_KEY);
      return localStorage.getItem(HC_CONNECTED_KEY) === "true";
    } catch { return false; }
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

      // Trust the unit returned by the native plugin. Health Connect's
      // WeightRecord is always in kg natively, but we still derive the
      // label from the record so any future provider that returns lbs
      // can be displayed correctly. We never silently convert.
      let weightUnit: "kg" | "lbs" = "kg";

      try {
        // Widen weight window to 365 days — fetch the most recently
        // entered weight, as users may not log weight frequently.
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);
        const weightTimeRange = { startTime: oneYearAgo.toISOString(), endTime: now.toISOString() };
        const weightResult = await HealthConnect.readWeight(weightTimeRange);
        if (weightResult.records.length > 0) {
          // records are returned in chronological order — take the latest
          const latest = weightResult.records[weightResult.records.length - 1];
          const value = toFiniteNumber(latest.value);
          const reportedUnit = (latest.unit || "kg").toLowerCase();
          weightUnit = reportedUnit === "lb" || reportedUnit === "lbs" ? "lbs" : "kg";
          weight = Math.round(value * 10) / 10;
          // Build fingerprint so we can prove the kg-aware bundle is live
          console.info(
            `[HealthConnectContext] weight build=v3 latest=${weight}${weightUnit} ` +
            `records=${weightResult.records.length} ts=${latest.timestamp}`
          );
        } else {
          console.info("[HealthConnectContext] weight build=v3 no records in 365d window");
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

  // Auto-reconnect on app resume when previously connected.
  // Always verify against the OS — never trust the cached flag alone.
  useEffect(() => {
    const cached = isConnected;
    console.info(
      "[HealthConnect] mount native=", Capacitor.isNativePlatform(),
      "cachedConnected=", cached,
    );
    if (!Capacitor.isNativePlatform()) return;

    const tryReconnect = async () => {
      try {
        if (!Capacitor.isPluginAvailable("HealthConnect")) {
          console.info("[HealthConnect] plugin unavailable in this build");
          if (cached) setIsConnected(false);
          return;
        }
        const { status } = await HealthConnect.checkAvailability();
        console.info("[HealthConnect] availability status=", status);
        if (status !== "available") {
          if (cached) setIsConnected(false);
          return;
        }
        if (!cached) {
          // Not previously connected — wait for explicit user prompt.
          return;
        }
        // Probe with a real read; if it throws (perms revoked or
        // never granted on this fresh install), drop the cached flag
        // so the UI re-prompts.
        try {
          await fetchHealthData();
        } catch (e) {
          console.warn("[HealthConnect] probe read failed → clearing cached connection", e);
          setIsConnected(false);
        }
      } catch (e) {
        console.warn("[HealthConnect] tryReconnect error", e);
      }
    };

    tryReconnect();

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
