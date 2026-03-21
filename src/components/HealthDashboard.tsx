import { Footprints, Heart, Weight, RefreshCw, Flame } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useHealthConnectContext } from '@/contexts/HealthConnectContext';

export const HealthDashboard = () => {
  const {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnectContext();

  // Don't show on non-native or if not connected and not on Android
  if (!Capacitor.isNativePlatform() && !isConnected) return null;

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Health Data</h2>
        {isConnected && (
          <button
            onClick={fetchHealthData}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
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
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-muted rounded-xl p-3 text-center">
            <Footprints size={16} className="mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">{healthData.steps.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Steps</p>
          </div>
          <div className="bg-muted rounded-xl p-3 text-center">
            <Heart size={16} className="mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold text-foreground">{healthData.heartRate || "—"}</p>
            <p className="text-[10px] text-muted-foreground">BPM</p>
          </div>
          <div className="bg-muted rounded-xl p-3 text-center">
            <Weight size={16} className="mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">
              {healthData.weight ? healthData.weight.toFixed(1) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">kg</p>
          </div>
          <div className="bg-muted rounded-xl p-3 text-center">
            <Flame size={16} className="mx-auto text-orange-500 mb-1" />
            <p className="text-lg font-bold text-foreground">
              {Math.round(healthData.activeCalories || 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">kcal</p>
          </div>
        </div>
        {healthData.calorieDebug && (
          <div className="bg-muted/50 border border-border rounded-lg p-2 text-[10px] text-muted-foreground font-mono">
            <p>🔍 <strong>Calorie Debug</strong></p>
            <p>Source: {healthData.calorieDebug.source}</p>
            <p>Origins: {healthData.calorieDebug.origins}</p>
            <p>Raw value: {healthData.calorieDebug.rawValue.toFixed(1)} kcal</p>
            <p>Records sum: {healthData.activeCalories.toFixed(1)} kcal</p>
          </div>
        )}
    </div>
  );
};
