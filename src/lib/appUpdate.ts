// Google Play in-app update prompt (Android only).
//
// Flexible flow: Google's own sheet appears inside the app, the download runs
// in the background, then we complete the install. Dismissible — a skip is
// remembered for 24h. Checks are throttled to once per hour. Everything fails
// silently: this must never block app usage.

import { Capacitor } from "@capacitor/core";

const LAST_CHECK_KEY = "app-update-last-check";
const SNOOZE_KEY = "app-update-snooze-until";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours

function now() {
  return Date.now();
}

function readTs(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeTs(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function isAndroidNative(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/**
 * Checks Google Play for a newer version and, if one exists, shows the
 * flexible in-app update flow. Returns a short status string for logging.
 */
export async function maybePromptAppUpdate(
  source: "startup" | "resume",
): Promise<string> {
  if (!isAndroidNative()) return "skipped:not-android";

  if (now() < readTs(SNOOZE_KEY)) return "skipped:snoozed";
  if (now() - readTs(LAST_CHECK_KEY) < CHECK_INTERVAL_MS) return "skipped:throttled";
  writeTs(LAST_CHECK_KEY, now());

  try {
    const { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } =
      await import("@capawesome/capacitor-app-update");

    const info = await AppUpdate.getAppUpdateInfo();
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
      return "no-update";
    }

    if (info.flexibleUpdateAllowed) {
      const result = await AppUpdate.startFlexibleUpdate();
      // CANCELED / anything other than OK → user dismissed; snooze 24h.
      if (result.code !== 0) {
        writeTs(SNOOZE_KEY, now() + SNOOZE_MS);
        return `dismissed:${result.code}`;
      }
      await AppUpdate.addListener("onFlexibleUpdateStateChange", async (state) => {
        if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
          try {
            await AppUpdate.completeFlexibleUpdate();
          } catch {
            /* ignore */
          }
        }
      });
      return "flexible-started";
    }

    // Flexible not allowed by Play → send the user to the store listing.
    await AppUpdate.openAppStore();
    writeTs(SNOOZE_KEY, now() + SNOOZE_MS);
    return "opened-store";
  } catch (e) {
    console.info(`[AppUpdate] check failed source=${source}`, e);
    return "error";
  }
}
