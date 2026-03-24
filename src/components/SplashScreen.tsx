import { useState, useEffect } from "react";

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
      {/* Subtle radial glow */}
      <div className="absolute w-[300px] h-[300px] rounded-full bg-primary/10 blur-[80px]" />

      {/* Brand */}
      <div
        className={`relative flex flex-col items-center transition-all duration-700 ease-out ${
          phase === "in" ? "opacity-0 scale-90 translate-y-4" : "opacity-100 scale-100 translate-y-0"
        }`}
      >
        <h1 className="text-[2.4rem] font-semibold tracking-[-0.03em] leading-none">
          <span className="text-primary drop-shadow-[0_0_24px_hsl(var(--primary)/0.45)]">
            Carnivore
          </span>
          <span className="text-primary/50 font-light">X</span>
        </h1>
        <p className="text-muted-foreground text-[11px] uppercase tracking-[0.25em] mt-3 font-medium">
          Fuel Your Edge
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
