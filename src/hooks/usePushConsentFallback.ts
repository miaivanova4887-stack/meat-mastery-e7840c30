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

      const alreadyShown = sessionStorage.getItem(SESSION_FLAG) === "1";
      const onboardingProgressed = isOnboardingProgressed();
      console.info(
        "[Push] fallback timer fired source=",
        source,
        { native, platform, alreadyShown, onboardingProgressed, elapsedAtFire: Date.now() - appStartAt },
      );

      if (alreadyShown) {
        console.info("[Push] fallback skipped reason=already-shown-session source=", source);
        return;
      }

      const openSheet = (branch: "auth" | "anonymous", consent: string, extra: Record<string, unknown> = {}) => {
        if (cancelled) return;
        if (sessionStorage.getItem(SESSION_FLAG) === "1") {
          console.info("[Push] fallback skipped reason=race-already-shown source=", source);
          return;
        }
        sessionStorage.setItem(SESSION_FLAG, "1");
        console.info(
          "[Push] fallback reason=open source=",
          source,
          { branch, consent, ...extra },
        );
        setOpen(true);
      };

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        const userPresent = !!user;

        if (!userPresent) {
          // Anonymous branch — only after some progression.
          const localConsent = getLocalPushConsent();
          console.info(
            "[Push] fallback anonymous check source=",
            source,
            { localConsent, onboardingProgressed },
          );

          if (localConsent !== "unset") {
            console.info(
              "[Push] fallback skipped reason=anonymous-consent-already-set source=",
              source,
              { localConsent },
            );
            return;
          }
          if (!onboardingProgressed) {
            console.info(
              "[Push] fallback skipped reason=anonymous-not-progressed source=",
              source,
            );
            return;
          }
          openSheet("anonymous", localConsent, { onboardingProgressed });
          return;
        }

        // Authenticated branch — read consent + preferences.
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("push_consent, notification_preferences")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;

        if (error || !data) {
          // Profile row not yet created — fall back to local mirror.
          const localConsent = getLocalPushConsent();
          console.info(
            "[Push] fallback profile-row missing — using local source=",
            source,
            { localConsent, error: error?.message },
          );
          if (localConsent !== "unset") {
            console.info(
              "[Push] fallback skipped reason=auth-local-consent-already-set source=",
              source,
              { localConsent },
            );
            return;
          }
          openSheet("auth", localConsent, { profileMissing: true });
          return;
        }

        const consent: string = data.push_consent ?? "unset";
        const prefsOptedIn = prefsIndicatePushOptIn(data.notification_preferences);
        console.info(
          "[Push] fallback auth check source=",
          source,
          { userPresent, consent, prefsOptedIn },
        );

        if (consent === "granted") {
          console.info("[Push] fallback skipped reason=consent-granted source=", source);
          return;
        }
        if (consent === "denied") {
          console.info("[Push] fallback skipped reason=consent-denied source=", source);
          return;
        }
        if (prefsOptedIn) {
          console.info(
            "[Push] fallback skipped reason=prefs-indicate-opted-in source=",
            source,
            { consent },
          );
          return;
        }
        openSheet("auth", consent, { prefsOptedIn });
      } catch (e) {
        console.warn("[Push] fallback check failed source=", source, e);
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
