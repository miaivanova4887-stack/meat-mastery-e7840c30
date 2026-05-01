import { Capacitor } from "@capacitor/core";

const BuildStamp = () => {
  const platform = Capacitor.getPlatform();
  const stamp = typeof __BUILD_TIMESTAMP__ === "string" ? __BUILD_TIMESTAMP__ : "dev";
  const fp = typeof __BUILD_FINGERPRINT__ === "string"
    ? __BUILD_FINGERPRINT__.replace(/^build-/, "").slice(-8)
    : "dev";

  return (
    <div
      className="pointer-events-none fixed right-2 z-50 rounded-md border border-border/70 bg-card/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur font-mono"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      aria-label="build-version"
    >
      {stamp} · {platform} · {fp}
    </div>
  );
};

export default BuildStamp;
