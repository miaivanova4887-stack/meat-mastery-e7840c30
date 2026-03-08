import { ArrowLeft, Smartphone, Heart, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const platforms = [
  {
    id: "apple_health",
    name: "Apple Health",
    icon: Heart,
    color: "text-red-500 bg-red-500/10",
    description: "Sync steps, heart rate, weight, and workouts from HealthKit.",
    available: true,
  },
  {
    id: "health_connect",
    name: "Health Connect",
    icon: Activity,
    color: "text-green-500 bg-green-500/10",
    description: "Sync steps, heart rate, weight, and workouts from Android Health Connect.",
    available: true,
  },
];

const syncCategories = [
  { metric: "Steps", from: "Both", mapped: "Exercise / Diet Trends" },
  { metric: "Heart Rate", from: "Both", mapped: "Vitals" },
  { metric: "Weight", from: "Both", mapped: "Body Measurements" },
  { metric: "Blood Pressure", from: "Both", mapped: "Vitals" },
  { metric: "Blood Glucose", from: "Both", mapped: "Vitals" },
  { metric: "Sleep", from: "Both", mapped: "Mood" },
];

const HealthSync = () => {
  const navigate = useNavigate();

  const handleConnect = (platformId: string) => {
    // In a Capacitor native build, this would invoke the HealthKit/Health Connect plugin
    // For now, show info about native setup
    alert(
      platformId === "apple_health"
        ? "Apple Health sync requires the native iOS app. Export to GitHub, add Capacitor iOS, and run on a real device."
        : "Health Connect sync requires the native Android app. Export to GitHub, add Capacitor Android, and run on a real device."
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-foreground p-1">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-foreground">Health Sync</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Smartphone size={28} className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Connect Smart Devices</h2>
          <p className="text-sm text-muted-foreground mt-1">Automatically sync your health data from wearables and health apps.</p>
        </div>

        {/* Platform cards */}
        {platforms.map((p) => (
          <div key={p.id} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.color}`}>
                <p.icon size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.description}</p>
              </div>
            </div>
            <Button onClick={() => handleConnect(p.id)} className="w-full" size="sm">
              Connect
            </Button>
          </div>
        ))}

        {/* Sync mapping */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
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

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-4">
          Health sync requires the native mobile app built with Capacitor. Export your project to GitHub, add iOS/Android platforms, and run on a real device.
        </p>
      </div>
    </div>
  );
};

export default HealthSync;
