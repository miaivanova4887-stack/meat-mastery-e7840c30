import { ArrowLeft, Flame, Play, Pause, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

const KETOSIS_TARGET_HOURS = 72;

const KetosisTimer = () => {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

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

  const reset = () => { setElapsed(0); setIsRunning(false); localStorage.removeItem("ketosis-timer"); };

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const progress = Math.min((elapsed / (KETOSIS_TARGET_HOURS * 3600)) * 100, 100);
  const inKetosis = hours >= KETOSIS_TARGET_HOURS;

  const phase = hours < 12 ? "Glycogen Depletion" : hours < 24 ? "Fat Burning Begins" : hours < 48 ? "Deep Fat Adaptation" : hours < 72 ? "Approaching Ketosis" : "Full Ketosis! 🔥";

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Ketosis Timer</h1>
      </div>

      <div className="flex flex-col items-center pt-8 px-4">
        <div className="relative w-64 h-64">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r="120" stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
            <circle
              cx="130" cy="130" r="120"
              stroke={inKetosis ? "hsl(var(--gold))" : "hsl(var(--primary))"}
              strokeWidth="8" fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Flame size={24} className={`text-primary ${isRunning ? "animate-pulse-flame" : ""}`} />
            <span className="text-3xl font-display font-black text-foreground mt-1">
              {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground mt-1">{phase}</span>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
            {isRunning ? "Pause" : "Start"}
          </button>
          <button onClick={reset} className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary text-secondary-foreground text-sm">
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        <div className="w-full mt-8 space-y-2">
          <p className="text-xs text-muted-foreground text-center">Target: {KETOSIS_TARGET_HOURS} hours for full ketosis adaptation</p>
          {[
            { h: 12, label: "Glycogen stores begin depleting" },
            { h: 24, label: "Body shifts to burning fat" },
            { h: 48, label: "Deep fat adaptation accelerates" },
            { h: 72, label: "Full nutritional ketosis achieved" },
          ].map(m => (
            <div key={m.h} className={`flex items-center gap-3 p-3 rounded-lg border ${hours >= m.h ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
              <div className={`w-3 h-3 rounded-full ${hours >= m.h ? "bg-primary" : "bg-muted"}`} />
              <div>
                <span className="text-xs font-semibold text-foreground">{m.h}h</span>
                <span className="text-xs text-muted-foreground ml-2">{m.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KetosisTimer;
