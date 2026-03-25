import { Capacitor } from "@capacitor/core";

const BuildStamp = () => {
  const platform = Capacitor.getPlatform();
  const stamp = __BUILD_TIMESTAMP__ ?? "dev";

  return (
    <div
      className="pointer-events-none fixed left-2 z-50 rounded-md border border-border/70 bg-card/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur font-mono"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      aria-label="build-version"
    >
      Build {stamp} · {platform}
    </div>
  );
};

export default BuildStamp;