import { useState, useEffect } from "react";
import CarnivoreXLogo from "./CarnivoreXLogo";

const SplashScreen = ({ onFinished }: { onFinished: () => void }) => {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("out"), 1800);
    const t3 = setTimeout(onFinished, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Dual glow orbs */}
      <div className="absolute w-[200px] h-[200px] rounded-full bg-primary/8 blur-[100px] -translate-y-12" />
      <div className="absolute w-[120px] h-[120px] rounded-full blur-[60px] translate-y-8 translate-x-10"
        style={{ background: "hsl(var(--gold) / 0.1)" }}
      />

      <div
        className={`relative flex flex-col items-center transition-all duration-700 ease-out ${
          phase === "in" ? "opacity-0 scale-95 translate-y-3" : "opacity-100 scale-100 translate-y-0"
        }`}
      >
        <CarnivoreXLogo size="lg" />
        <div className="w-8 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent mt-4 mb-3" />
        <p className="text-muted-foreground text-[10px] uppercase tracking-[0.35em] font-medium">
          Fuel Your Edge
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
