import { Footprints, Heart, Weight, RefreshCw, Flame, Bug } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useHealthConnectContext } from '@/contexts/HealthConnectContext';
import { useState } from 'react';

// Build fingerprint — changes on every web build
const WEB_BUILD = (() => { try { return __BUILD_TIMESTAMP__; } catch { return 'dev'; } })();

export const HealthDashboard = () => {
  const {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnectContext();
  const [showDiag, setShowDiag] = useState(false);

  const toFiniteNumber = (value: unknown, fallback = 0) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatOneDecimal = (value: unknown) => {
    const parsed = toFiniteNumber(value, Number.NaN);
    return Number.isFinite(parsed) ? parsed.toFixed(1) : "—";
  };

  const safeSteps = toFiniteNumber(healthData.steps);
  const safeHeartRate = toFiniteNumber(healthData.heartRate);
  const safeWeight = toFiniteNumber(healthData.weight);
  const safeActiveCalories = toFiniteNumber(healthData.activeCalories);
  const safeDebugSource = healthData.calorieDebug?.source?.slice(0, 3) || "v15";
  const safeDebugOrigins = typeof healthData.calorieDebug?.origins === "string"
    ? healthData.calorieDebug.origins.slice(0, 2000)
    : "n/a";

  // Don't show on non-native or if not connected and not on Android
  if (!Capacitor.isNativePlatform() && !isConnected) return null;

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Health Data</h2>
        {isConnected && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDiag(prev => !prev)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Diagnostics"
            >
              <Bug size={14} />
            </button>
            <button
              onClick={fetchHealthData}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </div>

      {!isConnected ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Connect to Health Connect to track steps, heart rate, weight & calories burned.
          </p>
          <button
            onClick={requestPermissions}
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors active:scale-[0.97]"
          >
            {isLoading ? 'Connecting...' : 'Connect Health Data'}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-muted rounded-xl p-3 text-center">
              <Footprints size={16} className="mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{safeSteps.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Steps</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <Heart size={16} className="mx-auto text-destructive mb-1" />
              <p className="text-lg font-bold text-foreground">{safeHeartRate || "—"}</p>
              <p className="text-[10px] text-muted-foreground">BPM</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <Weight size={16} className="mx-auto text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">
                {safeWeight > 0 ? formatOneDecimal(safeWeight) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">kg</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <Flame size={16} className="mx-auto text-orange-500 mb-1" />
              <p className="text-lg font-bold text-foreground">
                {Math.round(safeActiveCalories)}
              </p>
              <p className="text-[10px] text-muted-foreground">kcal</p>
            </div>
          </div>
          {/* Build fingerprint — always visible when connected */}
          <p className="text-[9px] text-muted-foreground/60 font-mono text-right mt-1">
            web:{WEB_BUILD} · src:v15
          </p>

          {showDiag && healthData.calorieDebug && (
            <div className="bg-muted/50 border border-border rounded-lg p-2 text-[10px] text-muted-foreground font-mono mt-1">
              <p>🔍 <strong>Full Diagnostics</strong></p>
              <p>Source: {healthData.calorieDebug.source}</p>
              <p>Raw: {formatOneDecimal(healthData.calorieDebug.rawValue)} kcal</p>
              <p>Display: {formatOneDecimal(safeActiveCalories)} kcal</p>
              <p className="break-all mt-1 text-[8px]">{safeDebugOrigins}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
