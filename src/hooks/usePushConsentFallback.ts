// Push consent fallback hook.
//
// Mounted globally via PushConsentFallbackHost. Uses the shared
// auditPushDecision() so suppression logic is identical to the
// onboarding-end and Profile-settings paths.

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { auditPushDecision } from "@/lib/pushDecision";

const FALLBACK_DELAY_MIN_MS = 60_000;
const FALLBACK_DELAY_MAX_MS = 250_000;
const FALLBACK_DELAY_DEFAULT_MS = 90_000;

const appStartAt = Date.now();

function resolveDelayMs(): number {
  let delay = FALLBACK_DELAY_DEFAULT_MS;
  try {
    const raw = localStorage.getItem("push-fallback-delay-ms");
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) delay = n;
    }
  } catch {}
  return Math.max(FALLBACK_DELAY_MIN_MS, Math.min(FALLBACK_DELAY_MAX_MS, delay));
}

export type PushFallbackSource = "home" | "profile" | "shell";

export function usePushConsentFallback(source: PushFallbackSource) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const delayMs = resolveDelayMs();
    const elapsed = Date.now() - appStartAt;
    const remaining = Math.max(0, delayMs - elapsed);
    console.info(
      "[PushDecision] source=shell branch=mount",
      JSON.stringify({ source, appStartAt, elapsed, delayMs, remaining }),
    );

    const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web";
    const isSupportedNative = Capacitor.isNativePlatform() && (platform === "android" || platform === "ios");
    if (!isSupportedNative) {
      console.info(`[PushDecision] source=shell branch=suppress reason=unsupported-platform (mount) platform=${platform}`);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const decision = await auditPushDecision("shell", {
          requireOnboardingForAnonymous: true,
        });
        if (cancelled) return;
        if (decision.show) setOpen(true);
      } catch (e) {
        console.error("[PushDecision] source=shell branch=audit-threw — swallowed", e);
      }
    }, remaining);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source]);

  return {
    open,
    onClose: () => setOpen(false),
  };
}
