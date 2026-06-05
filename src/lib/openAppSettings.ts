import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

/**
 * Opens the OS-level settings screen for this app.
 * On iOS 15.4+ this prefers the app-specific Notifications page; older iOS
 * falls back to the app settings page. Android always opens app details.
 * Returns true if the plugin reports success.
 */
export const openAppSettings = async (): Promise<boolean> => {
  console.info("[NotifSettings] CTA tapped");
  if (!Capacitor.isNativePlatform()) {
    console.info("[NotifSettings] non-native — skipping");
    return false;
  }

  const platform = Capacitor.getPlatform();
  console.info("[NotifSettings] opening", platform === "ios" ? "iOS app notification settings" : "Android app details");

  // First attempt: dedicated notifications screen.
  try {
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.AppNotification,
    });
    console.info("[NotifSettings] plugin result (AppNotification)", result);
    if (typeof result?.status === "boolean") {
      if (result.status) return true;
    } else {
      return true;
    }
  } catch (e) {
    console.warn("[NotifSettings] AppNotification threw", e);
  }

  // Fallback: generic app settings page (covers iOS <15.4).
  try {
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    console.info("[NotifSettings] plugin result (App)", result);
    if (typeof result?.status === "boolean") return result.status;
    return true;
  } catch (e) {
    console.warn("[NotifSettings] App fallback threw", e);
  }

  // Last-ditch fallback via Capacitor App plugin (some versions expose it).
  try {
    const openSettings = (CapacitorApp as unknown as { openSettings?: () => Promise<void> })?.openSettings;
    if (typeof openSettings !== "function") {
      console.warn("[NotifSettings] no openSettings on CapacitorApp");
      return false;
    }
    await openSettings.call(CapacitorApp);
    console.info("[NotifSettings] CapacitorApp.openSettings ok");
    return true;
  } catch (e) {
    console.error("[NotifSettings] all fallbacks failed", e);
    return false;
  }
};
