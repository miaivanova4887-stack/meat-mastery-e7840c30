import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { maybePromptAppUpdate } from "@/lib/appUpdate";

/**
 * Checks for a newer Play Store version on app start and on each foreground
 * resume (throttled inside maybePromptAppUpdate). Android native only.
 */
export function useAppUpdatePrompt() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void maybePromptAppUpdate("startup");
    }, 3000);

    const handle = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void maybePromptAppUpdate("resume");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void handle.then((h) => h.remove()).catch(() => {});
    };
  }, []);
}
