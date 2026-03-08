import { ArrowLeft, Flame, Play, Pause, RotateCcw, Info, Bell, BellOff, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import ketosisPhase1Video from "@/assets/ketosis-phase-1.mp4";
import ketosisPhase2Video from "@/assets/ketosis-phase-2.mp4";
import ketosisPhase4Video from "@/assets/ketosis-phase-4.mp4";

const PHASE_VIDEOS: Record<number, string | null> = {
  0: ketosisPhase1Video,
  1: ketosisPhase2Video,
  2: null, // Phase 3 - generation pending
  3: ketosisPhase4Video,
};
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { Goal, ActivityLevel, Struggle } from "@/contexts/UserProfileContext";
import { toast } from "sonner";
import { subscribeToPush, sendPushToAll } from "@/lib/pushNotifications";

const KETOSIS_TARGET_HOURS = 72;

interface PhaseInfo {
  name: string;
  range: string;
  tip: string;
}

function getPhases(goal: Goal, activity: ActivityLevel, struggles: Struggle[], weight: number | null): PhaseInfo[] {
  const isActive = activity === "moderate" || activity === "very_active";
  const hasCravings = struggles.includes("sugar_cravings");
  const hasLowEnergy = struggles.includes("low_energy");
  const hasDigestive = struggles.includes("digestive");

  return [
    {
      name: "Glycogen Depletion",
      range: "0 – 12h",
      tip: isActive
        ? "Your active lifestyle means glycogen may deplete faster. Stay hydrated with electrolytes."
        : hasCravings
        ? "Cravings may spike here — beef jerky or bone broth can help you push through."
        : "Your body is using up stored glucose. Drink water and stay busy.",
    },
    {
      name: "Fat Burning Begins",
      range: "12 – 24h",
      tip: goal === "lose_weight"
        ? "This is where fat loss accelerates. Your body is switching fuel sources — keep going."
        : hasLowEnergy
        ? "Energy may dip as your body transitions. Rest is productive right now."
        : goal === "build_muscle"
        ? "Protein synthesis continues. Keep protein high to protect lean mass during the switch."
        : "Your metabolism is shifting. Gentle movement helps the transition.",
    },
    {
      name: "Deep Fat Adaptation",
      range: "24 – 48h",
      tip: goal === "lose_weight" && weight
        ? `At ${weight}kg, your body is now heavily drawing from fat stores. Mental clarity often improves here.`
        : hasDigestive
        ? "Digestive discomfort usually eases by this phase as your gut adapts to fat metabolism."
        : goal === "improve_health"
        ? "Autophagy ramps up — your body is actively repairing and recycling damaged cells."
        : isActive
        ? "Fat-fueled workouts may feel different. Lower intensity is fine — adaptation takes time."
        : "Deep adaptation is underway. Many people notice improved focus and stable energy.",
    },
    {
      name: "Full Ketosis",
      range: "48 – 72h",
      tip: goal === "build_muscle"
        ? "Ketones are now your primary fuel. Strength may feel different but endurance often improves."
        : goal === "lose_weight"
        ? "Peak fat burning. Your body is now a fat-adapted machine — this is where results compound."
        : goal === "improve_health"
        ? "Maximum cellular repair mode. Inflammation markers are typically at their lowest."
        : "You've reached full nutritional ketosis. Maintain with quality animal fats and protein.",
    },
  ];
}

function getCurrentPhaseIndex(hours: number): number {
  if (hours < 12) return 0;
  if (hours < 24) return 1;
  if (hours < 48) return 2;
  return 3;
}

// Play a short chime using Web Audio API
function playMilestoneChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 - a pleasant triad
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.5);
    });
  } catch {
    // Audio not available
  }
}

// Send browser notification
function sendNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "🔥" });
  }
}

const KetosisTimer = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    return localStorage.getItem("ketosis-alerts") !== "false";
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastPhaseRef = useRef<number>(-1);

  useEffect(() => {
    const saved = localStorage.getItem("ketosis-timer");
    if (saved) {
      const { startTime, running } = JSON.parse(saved);
      if (running && startTime) {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(diff);
        setIsRunning(true);
      } else if (startTime) {
        setElapsed(JSON.parse(saved).elapsed || 0);
      }
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      localStorage.setItem("ketosis-timer", JSON.stringify({ startTime: Date.now() - elapsed * 1000, running: true }));
    } else {
      clearInterval(intervalRef.current);
      localStorage.setItem("ketosis-timer", JSON.stringify({ running: false, elapsed }));
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const reset = () => { setElapsed(0); setIsRunning(false); lastPhaseRef.current = -1; localStorage.removeItem("ketosis-timer"); };

  const toggleAlerts = useCallback(async () => {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    localStorage.setItem("ketosis-alerts", String(next));
    if (next) {
      // Request notification permission and subscribe to push
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const subscribed = await subscribeToPush();
      if (subscribed) {
        toast("Push notifications enabled — you'll be alerted even when the app is closed");
      } else {
        toast("Milestone alerts enabled (in-app only)");
      }
    } else {
      toast("Milestone alerts muted");
    }
  }, [alertsEnabled]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const progress = Math.min((elapsed / (KETOSIS_TARGET_HOURS * 3600)) * 100, 100);
  const inKetosis = hours >= KETOSIS_TARGET_HOURS;

  const phases = getPhases(profile.goal, profile.activityLevel, profile.struggles, profile.body.weight);
  const currentPhaseIdx = getCurrentPhaseIndex(hours);
  const currentPhase = phases[currentPhaseIdx];

  // Detect phase transitions and fire alerts
  useEffect(() => {
    if (lastPhaseRef.current === -1) {
      lastPhaseRef.current = currentPhaseIdx;
      return;
    }
    if (currentPhaseIdx > lastPhaseRef.current && isRunning && alertsEnabled) {
      playMilestoneChime();
      const phase = phases[currentPhaseIdx];
      toast(`🔥 ${phase.name}`, { description: phase.tip, duration: 6000 });
      sendNotification(`🔥 ${phase.name}`, phase.tip);
      // Also send true push notification for background delivery
      sendPushToAll(`🔥 ${phase.name}`, phase.tip).catch(() => {});
    }
    lastPhaseRef.current = currentPhaseIdx;
  }, [currentPhaseIdx, isRunning, alertsEnabled, phases]);

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const milestoneHours = [12, 24, 48, 72];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Ketosis Timer</h1>
        <button onClick={toggleAlerts} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle milestone alerts">
          {alertsEnabled ? <Bell size={18} strokeWidth={1.5} /> : <BellOff size={18} strokeWidth={1.5} />}
        </button>
      </div>

      <div className="flex flex-col items-center pt-8 px-4">
        {/* Ring */}
        <div className="relative w-64 h-64">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r="120" stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
            <circle
              cx="130" cy="130" r="120"
              stroke={inKetosis ? "hsl(var(--gold))" : "hsl(var(--primary))"}
              strokeWidth="6" fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Flame size={22} strokeWidth={1.5} className={`text-primary ${isRunning ? "animate-pulse-flame" : ""}`} />
            <span className="text-3xl font-display font-bold text-foreground mt-1 tracking-tight">
              {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground mt-1">{currentPhase.name}{inKetosis ? " 🔥" : ""}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.97]"
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
            {isRunning ? "Pause" : "Start"}
          </button>
          <button onClick={reset} className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-secondary text-secondary-foreground text-sm transition-all active:scale-[0.97]">
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        {/* Current phase personalised tip */}
        <div className="w-full mt-8">
          <div className="ios-card p-4 flex gap-3 items-start">
            <Info size={16} strokeWidth={1.5} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">{currentPhase.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{currentPhase.tip}</p>
            </div>
          </div>
        </div>

        {/* Phase milestones */}
        <div className="w-full mt-4 space-y-2">
          <p className="text-xs text-muted-foreground text-center mb-3">Target: {KETOSIS_TARGET_HOURS}h for full ketosis</p>
          {phases.map((phase, i) => {
            const h = milestoneHours[i];
            const reached = hours >= h;
            const isCurrent = i === currentPhaseIdx;
            const video = PHASE_VIDEOS[i];
            return (
              <div key={h} className="space-y-2">
                <div
                  className={`ios-card flex items-center gap-3 p-3 transition-all ${
                    isCurrent ? "ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${reached ? "bg-primary" : isCurrent ? "bg-primary/40" : "bg-muted"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-foreground">{phase.name}</span>
                      <span className="text-[11px] text-muted-foreground">{phase.range}</span>
                    </div>
                  </div>
                </div>
                {isCurrent && video && (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <video
                      src={video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KetosisTimer;
