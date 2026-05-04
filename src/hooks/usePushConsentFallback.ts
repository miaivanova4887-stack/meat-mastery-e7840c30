// Push consent fallback hook.
//
// Decoupled from onboarding completion AND from a logged-in profile.
// Holds the prompt behind a SHARED shell-level grace timer so it never
// fires immediately on launch, then runs strict eligibility checks
// before opening the consent sheet.
//
// Mounted globally via PushConsentFallbackHost so it runs on every route.
// `appStartAt` is module-scoped — route changes do NOT restart the timer.

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getLocalPushConsent } from "@/lib/pushConsentLocal";
import { getNativePushPermission, savePushConsent } from "@/lib/pushFcm";

const SESSION_FLAG = "push-prompt-shown";

// Grace window: never prompt before MIN, never wait longer than MAX.
// QA can override via localStorage["push-fallback-delay-ms"].
const FALLBACK_DELAY_MIN_MS = 60_000;
const FALLBACK_DELAY_MAX_MS = 250_000;
const FALLBACK_DELAY_DEFAULT_MS = 90_000;

// Module-scoped: one timestamp per JS bundle / app launch.
const appStartAt = Date.now();

function resolveDelayMs(): number {
  let delay = FALLBACK_DELAY_DEFAULT_MS;
  try {
    const raw = localStorage.getItem("push-fallback-delay-ms");
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) delay = n;
    }
  } catch {
    // ignore
  }
  return Math.max(FALLBACK_DELAY_MIN_MS, Math.min(FALLBACK_DELAY_MAX_MS, delay));
}

function isOnboardingProgressed(): boolean {
  try {
    return (
      localStorage.getItem("carnivore-onboarding-complete-v2") === "true" ||
      localStorage.getItem("carnivore-onboarding-complete") === "true"
    );
  } catch {
    return false;
  }
}

function prefsIndicatePushOptIn(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return false;
  const p = prefs as Record<string, unknown>;
  return (
    p.streaks === true ||
    p.recipes === true ||
    p.fasting === true ||
    p.coaching === true
  );
}

export type PushFallbackSource = "home" | "profile" | "shell";

export function usePushConsentFallback(source: PushFallbackSource) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const delayMs = resolveDelayMs();
    const now = Date.now();
    const elapsed = now - appStartAt;
    const remaining = Math.max(0, delayMs - elapsed);

    console.info(
      "[Push] fallback hook mounted source=",
      source,
      { appStartAt, now, elapsed, delayMs, remaining },
    );

    const native = Capacitor.isNativePlatform();
    const platform = native ? Capacitor.getPlatform() : "web";

    if (!native || platform !== "android") {
      console.info("[Push] fallback skipped reason=not-android source=", source, { native, platform });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const alreadyShown = sessionStorage.getItem(SESSION_FLAG) === "1";
        const onboardingProgressed = isOnboardingProgressed();
        console.info(
          "[PushDecision] timer-fired source=", source,
          { native, platform, alreadyShown, onboardingProgressed, elapsedAtFire: Date.now() - appStartAt },
        );

        if (alreadyShown) {
          console.info("[PushDecision] skip reason=already-shown-session source=", source);
          return;
        }

        // (1) Local mirror — covers anonymous and freshly-saved consent.
        const localConsent = getLocalPushConsent();
        if (localConsent !== "unset") {
          console.info("[PushDecision] skip reason=local-consent-set source=", source, { localConsent });
          sessionStorage.setItem(SESSION_FLAG, "1");
          return;
        }

        // (2) Auth profile — if user has a consent decision, do NOT prompt.
        let userId: string | null = null;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id ?? null;
        } catch (e) {
          console.warn("[PushDecision] getUser failed source=", source, e);
        }
        if (cancelled) return;

        if (userId) {
          try {
            const { data, error } = await (supabase as any)
              .from("profiles")
              .select("push_consent, notification_preferences")
              .eq("id", userId)
              .maybeSingle();
            if (cancelled) return;
            if (!error && data) {
              const consent: string = data.push_consent ?? "unset";
              if (consent === "granted" || consent === "denied") {
                console.info("[PushDecision] skip reason=profile-consent-set source=", source, { consent });
                sessionStorage.setItem(SESSION_FLAG, "1");
                return;
              }
              if (prefsIndicatePushOptIn(data.notification_preferences)) {
                console.info("[PushDecision] skip reason=prefs-opted-in source=", source);
                sessionStorage.setItem(SESSION_FLAG, "1");
                return;
              }
            } else if (error) {
              console.warn("[PushDecision] profile read error source=", source, error.message);
            }
          } catch (e) {
            console.warn("[PushDecision] profile read threw source=", source, e);
          }
        }

        // (3) OS guard — if OS already granted, reconcile + skip.
        let osPerm: string = "unsupported";
        try { osPerm = await getNativePushPermission(); } catch (e) {
          console.warn("[PushDecision] getNativePushPermission threw source=", source, e);
        }
        console.info("[PushDecision] os-perm source=", source, { osPerm });
        if (osPerm === "granted") {
          try { await savePushConsent("granted"); } catch (e) {
            console.warn("[PushDecision] savePushConsent reconcile failed", e);
          }
          sessionStorage.setItem(SESSION_FLAG, "1");
          console.info("[PushDecision] skip reason=os-already-granted source=", source);
          return;
        }

        // (4) Anonymous gate — only prompt after onboarding has progressed.
        if (!userId && !onboardingProgressed) {
          console.info("[PushDecision] skip reason=anonymous-not-progressed source=", source);
          return;
        }

        // (5) Open the sheet.
        if (sessionStorage.getItem(SESSION_FLAG) === "1") {
          console.info("[PushDecision] skip reason=race-already-shown source=", source);
          return;
        }
        sessionStorage.setItem(SESSION_FLAG, "1");
        console.info("[PushDecision] open source=", source, { branch: userId ? "auth" : "anonymous" });
        setOpen(true);
      } catch (e) {
        // Defensive: a throw here must NEVER crash React.
        console.error("[PushDecision] timer body threw — swallowed source=", source, e);
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
