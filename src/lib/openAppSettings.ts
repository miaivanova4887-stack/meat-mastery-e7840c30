import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

export const openAppSettings = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    if (typeof result?.status === "boolean") return result.status;
    return true;
  } catch {
    // fallback for environments where the native settings plugin is unavailable
  }

  try {
    const openSettings = (CapacitorApp as any)?.openSettings;
    if (typeof openSettings !== "function") return false;
    await openSettings.call(CapacitorApp);
    return true;
  } catch {
    return false;
  }
};
