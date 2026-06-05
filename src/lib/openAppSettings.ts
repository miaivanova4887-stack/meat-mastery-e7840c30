import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

/**
 * Opens the OS-level settings screen for this app. On iOS 15.4+ this opens
 * the app-specific Notifications page; older iOS falls back to the app
 * settings page. Android always opens app details.
 *
 * Heavily instrumented so we can prove from the device console which branch
 * actually ran when the user taps the in-app CTA.
 */
export const openAppSettings = async (traceId?: string): Promise<boolean> => {
  const t = traceId || `nsx_${Date.now()}`;
  console.info("[NotifSettings] open() called", { traceId: t });

  if (!Capacitor.isNativePlatform()) {
    console.info("[NotifSettings] open() non-native — skipping", { traceId: t });
    return false;
  }

  const platform = Capacitor.getPlatform();
  console.info("[NotifSettings] open() platform", { traceId: t, platform });

  // Attempt 1: dedicated notifications screen (iOS 15.4+).
  try {
    console.info("[NotifSettings] open() attempt=AppNotification", { traceId: t });
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.AppNotification,
    });
    console.info("[NotifSettings] open() result=AppNotification", { traceId: t, result });
    if (typeof result?.status === "boolean") {
      if (result.status) return true;
    } else {
      return true;
    }
  } catch (e) {
    console.warn("[NotifSettings] open() AppNotification threw", { traceId: t, error: String(e) });
  }

  // Attempt 2: generic app settings page.
  try {
    console.info("[NotifSettings] open() attempt=App", { traceId: t });
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    console.info("[NotifSettings] open() result=App", { traceId: t, result });
    if (typeof result?.status === "boolean") return result.status;
    return true;
  } catch (e) {
    console.warn("[NotifSettings] open() App fallback threw", { traceId: t, error: String(e) });
  }

  // Attempt 3: Capacitor App.openSettings (rare).
  try {
    const openSettings = (CapacitorApp as unknown as { openSettings?: () => Promise<void> })?.openSettings;
    if (typeof openSettings !== "function") {
      console.warn("[NotifSettings] open() no CapacitorApp.openSettings", { traceId: t });
      return false;
    }
    console.info("[NotifSettings] open() attempt=CapacitorApp.openSettings", { traceId: t });
    await openSettings.call(CapacitorApp);
    console.info("[NotifSettings] open() result=CapacitorApp.openSettings ok", { traceId: t });
    return true;
  } catch (e) {
    console.error("[NotifSettings] open() all fallbacks failed", { traceId: t, error: String(e) });
    return false;
  }
};
