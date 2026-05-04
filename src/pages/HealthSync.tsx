import { ArrowLeft, Smartphone, Heart, Activity, Loader2, CheckCircle2, AlertCircle, Footprints, Weight, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useHealthConnect } from "@/hooks/useHealthConnect";
import { Capacitor } from "@capacitor/core";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const syncCategories = [
  { metric: "Steps", mapped: "Exercise / Diet Trends" },
  { metric: "Heart Rate", mapped: "Vitals" },
  { metric: "Weight", mapped: "Body Measurements" },
  { metric: "Blood Pressure", mapped: "Vitals" },
  { metric: "Blood Glucose", mapped: "Vitals" },
  { metric: "Sleep", mapped: "Mood" },
];

const HealthSync = () => {
  const navigate = useNavigate();
  const { healthData, isConnected, isLoading, error, requestPermissions } = useHealthConnect();
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const isIOS = platform === "ios";
  const isAndroid = platform === "android";
  useScrollToTop();

  const toFiniteNumber = (value: unknown, fallback = 0) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const safeSteps = toFiniteNumber(healthData.steps);
  const safeHeartRate = toFiniteNumber(healthData.heartRate);
  const safeWeight = toFiniteNumber(healthData.weight);
  const safeRecordCalories = toFiniteNumber(healthData.activeCalories);

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-foreground p-1">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-foreground">
            {isConnected ? "Connected Devices" : "Health Sync"}
          </h1>
          {isConnected && <CheckCircle2 size={16} className="text-green-500 ml-auto" />}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl px-4 pt-4 space-y-4">
        <div className="text-center py-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isConnected ? "bg-green-500/10" : "bg-primary/10"}`}>
            {isConnected ? <CheckCircle2 size={28} className="text-green-500" /> : <Smartphone size={28} className="text-primary" />}
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {isConnected ? "Health Connect Active" : "Connect Smart Devices"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isConnected
              ? "Your health data is syncing automatically every 5 minutes."
              : "Automatically sync your health data from wearables and health apps."}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={18} className="text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Health Connect card */}
        <div className="ios-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-green-500 bg-green-500/10">
              <Activity size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{isIOS ? "Apple Health" : "Health Connect"}</p>
                {isConnected && <CheckCircle2 size={14} className="text-green-500" />}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isConnected
                  ? "Connected — auto-refreshing every 5 min"
                  : isIOS
                    ? "Sync steps, heart rate, weight from Apple Health."
                    : "Sync steps, heart rate, weight from Android Health Connect."}
              </p>
            </div>
          </div>

          {!isConnected ? (
            <Button onClick={requestPermissions} className="w-full" size="sm" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 size={14} className="mr-2 animate-spin" />Connecting…</>
              ) : "Connect"}
            </Button>
          ) : (
            <>
              {/*
               * Metric tile styling mirrors the homepage HealthDashboard
               * so both surfaces render identically: same four metrics
               * (Steps, BPM, Weight, Calories), same icons, same colour
               * tokens (`text-primary` for neutral, `text-destructive`
               * for heart, `text-orange-500` for calories), and the same
               * `grid-cols-4` layout. Anything that changes here should
               * also change in `src/components/HealthDashboard.tsx`.
               */}
              <div className="grid grid-cols-4 gap-2 mt-2">
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
                    {safeWeight ? `${safeWeight.toFixed(1)}` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kg</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <Flame size={16} className="mx-auto text-orange-500 mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {Math.round(safeRecordCalories)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">kcal</p>
                </div>
              </div>

            </>
          )}
        </div>

        {/* Sync mapping */}
        <div className="ios-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">What syncs where</p>
          </div>
          <div className="divide-y divide-border">
            {syncCategories.map((s) => (
              <div key={s.metric} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-foreground">{s.metric}</span>
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{s.mapped}</span>
              </div>
            ))}
          </div>
        </div>

        {!isNative && (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-4">
            Health sync requires the native mobile app. Build and install on iOS or Android to connect.
          </p>
        )}
      </div>
    </div>
  );
};

export default HealthSync;
