import { ArrowLeft, Smartphone, Heart, Activity, Loader2, CheckCircle2, AlertCircle, Footprints } from "lucide-react";
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
  const isAndroid = Capacitor.getPlatform() === "android";
  useScrollToTop();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
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

      <div className="px-4 pt-4 space-y-4">
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
                <p className="text-sm font-bold text-foreground">Health Connect</p>
                {isConnected && <CheckCircle2 size={14} className="text-green-500" />}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isConnected
                  ? "Connected — auto-refreshing every 5 min"
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
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <Footprints size={16} className="mx-auto text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">{healthData.steps.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Steps</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Heart size={16} className="mx-auto text-red-500 mb-1" />
                <p className="text-lg font-bold text-foreground">{healthData.heartRate || "—"}</p>
                <p className="text-[10px] text-muted-foreground">BPM</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Activity size={16} className="mx-auto text-blue-500 mb-1" />
                <p className="text-lg font-bold text-foreground">
                  {healthData.weight ? `${healthData.weight.toFixed(1)}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">kg</p>
              </div>
            </div>
          )}
        </div>

        {/* Apple Health — only show on iOS */}
        {(!isNative || !isAndroid) && Capacitor.getPlatform() === "ios" && (
          <div className="ios-card p-4 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 bg-red-500/10">
                <Heart size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Apple Health</p>
                <p className="text-[11px] text-muted-foreground">Coming soon — requires iOS build with HealthKit.</p>
              </div>
            </div>
          </div>
        )}

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
            Health sync requires the native Android APK. Build and install via Android Studio to use Health Connect.
          </p>
        )}
      </div>
    </div>
  );
};

export default HealthSync;
