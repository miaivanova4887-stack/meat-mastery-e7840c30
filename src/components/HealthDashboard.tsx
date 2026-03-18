import { useEffect, useRef } from 'react';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { Activity, Heart, Weight, Footprints, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export const HealthDashboard = () => {
  const {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnect();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh every 5 minutes when connected
  useEffect(() => {
    if (isConnected) {
      fetchHealthData();
      intervalRef.current = setInterval(fetchHealthData, 5 * 60 * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, fetchHealthData]);

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
            Connect to Health Connect to track steps, heart rate & weight.
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
        <div className="grid grid-cols-3 gap-2">
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
        </div>
      )}
    </div>
  );
};
