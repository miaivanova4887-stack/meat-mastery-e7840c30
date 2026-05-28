/**
 * Fresh-install detection.
 *
 * iOS WKWebView localStorage is included in iCloud / device-to-device
 * backups, so onboarding flags can survive what the user perceives as a
 * "fresh" install (restoring a device from backup brings them back). To
 * detect a genuine fresh install we store a marker file in
 * NSCachesDirectory via our `AudioSession` Swift plugin — Caches is
 * NEVER backed up by iOS.
 *
 * On boot:
 *   - Marker missing  => fresh install: clear onboarding localStorage
 *                        keys, then write the marker.
 *   - Marker present  => keep flags as-is.
 *
 * Android already excludes WebView storage via backup_rules.xml; web
 * has no concept of "install". On those platforms this helper is a
 * no-op (it treats the marker as always present).
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

interface AudioSessionShape {
  readInstallMarker: () => Promise<{ present: boolean; value?: string }>;
  writeInstallMarker: (opts: { value: string }) => Promise<{ ok: boolean }>;
}

const AudioSession = registerPlugin<AudioSessionShape>("AudioSession");

const ONBOARDING_KEYS = [
  "carnivore-onboarding-complete-v3",
  "carnivore-onboarding-answers",
  "carnivore-onboarding-body",
];

const clearOnboarding = () => {
  for (const key of ONBOARDING_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
};

export async function ensureInstallMarker(): Promise<void> {
  // Only run the native check on iOS — Android has backup exclusion and
  // web has no install lifecycle.
  if (Capacitor.getPlatform() !== "ios") {
    return;
  }
  try {
    const res = await AudioSession.readInstallMarker();
    if (res?.present) {
      console.info("[Onboarding] install marker present, keeping flags");
      return;
    }
    console.info("[Onboarding] fresh-install detected, clearing onboarding flags");
    clearOnboarding();
    const stamp = `${Date.now()}`;
    await AudioSession.writeInstallMarker({ value: stamp });
    console.info("[Onboarding] install marker written value=", stamp);
  } catch (err) {
    // Don't block app boot if the plugin is missing in an older build.
    console.warn("[Onboarding] install-marker check failed", err);
  }
}
