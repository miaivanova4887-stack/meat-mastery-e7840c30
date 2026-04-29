import { Capacitor } from "@capacitor/core";
import { useTranslation } from "react-i18next";

const BuildStamp = () => {
  const platform = Capacitor.getPlatform();
  const stamp = __BUILD_TIMESTAMP__ ?? "dev";
  const { t } = useTranslation();
  // Disclaimer probe: confirms i18n key resolves and bundle is fresh
  const discProbe = (t("disclaimer.main.title") || "??").slice(0, 4);

  return (
    <div
      className="pointer-events-none fixed right-2 z-50 rounded-md border border-border/70 bg-card/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur font-mono"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      aria-label="build-version"
    >
      Build {stamp} · {platform} · D:{discProbe}
    </div>
  );
};

export default BuildStamp;
