import { Footprints, Heart, Weight, Flame, CheckCircle2, Watch } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useHealthConnectContext } from '@/contexts/HealthConnectContext';
import { Button } from '@/components/ui/button';

export const HealthDashboard = () => {
  const navigate = useNavigate();
  const {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnectContext();

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
  // Platform-aware copy for the "setup" CTA. The dashboard header above
  // uses the neutral "Your Health & Fitness" label on both platforms, but
  // the setup subtitle names the concrete system the user will be granting
  // permission to — Apple Health on iOS, Google Health Connect on Android.
  const isIOS = Capacitor.getPlatform() === "ios";
  const healthProviderLabel = isIOS ? "Apple Health" : "Health Connect";
  const safeActiveCalories = toFiniteNumber(healthData.activeCalories);

  if (!Capacitor.isNativePlatform() && !isConnected) return null;

  if (!isConnected) {
    return (
      <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-border flex items-center gap-3">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.04]" />
        <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Watch size={18} className="text-primary" />
        </div>
        <div className="flex-1 relative">
          <p className="text-[13px] font-bold text-foreground">Sync Smart Devices</p>
          <p className="text-[11px] text-muted-foreground">Connect {healthProviderLabel} to track steps, heart rate, weight &amp; calories.</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 text-xs relative" onClick={requestPermissions} disabled={isLoading}>
          {isLoading ? 'Connecting…' : 'Setup'}
        </Button>
        {error && <p className="text-xs text-destructive absolute bottom-1 left-4">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-green-500/30">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-600/5" />
      <div className="relative flex items-center gap-2 mb-3">
        <CheckCircle2 size={16} className="text-green-500" />
        <p className="text-[13px] font-bold text-foreground">Your Health &amp; Fitness</p>
        <span className="text-[10px] text-muted-foreground ml-auto">Auto-refreshing</span>
      </div>
      <div className="relative grid grid-cols-4 gap-2">
        <div className="bg-muted rounded-lg p-3 text-center">
          <Footprints size={16} className="mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">{safeSteps.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Steps</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <Heart size={16} className="mx-auto text-destructive mb-1" />
          <p className="text-lg font-bold text-foreground">{safeHeartRate || "—"}</p>
          <p className="text-[10px] text-muted-foreground">BPM</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <Weight size={16} className="mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">
            {safeWeight > 0 ? formatOneDecimal(safeWeight) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">kg</p>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <Flame size={16} className="mx-auto text-orange-500 mb-1" />
          <p className="text-lg font-bold text-foreground">
            {Math.round(safeActiveCalories)}
          </p>
          <p className="text-[10px] text-muted-foreground">kcal</p>
        </div>
      </div>
    </div>
  );
};
