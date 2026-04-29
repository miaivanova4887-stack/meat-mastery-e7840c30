// Push consent fallback hook.
// Decoupled from onboarding completion AND from a logged-in profile:
// shows the consent sheet once per browser session for native Android
// users whose effective consent (profile if signed-in, else local mirror)
// is still 'unset'.
//
// Mounted globally via PushConsentFallbackHost so it runs on every route.
// The shared sessionStorage flag prevents double-prompts within a session.

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getLocalPushConsent } from "@/lib/pushConsentLocal";

const SESSION_FLAG = "push-prompt-shown";
// Short delay so onboarding-triggered sheet wins on the same launch.
const INITIAL_DELAY_MS = 600;

export type PushFallbackSource = "home" | "profile" | "shell";

export function usePushConsentFallback(source: PushFallbackSource) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Immediate mount log — fires before any guards so logcat confirms
    // the hook is at least being evaluated on this route/launch.
    console.info("[Push] fallback hook mounted source=", source);
    const native = Capacitor.isNativePlatform();
    const platform = native ? Capacitor.getPlatform() : "web";
    const alreadyShown = sessionStorage.getItem(SESSION_FLAG) === "1";
    console.info("[Push] fallback check source=", source, { native, platform, alreadyShown });

    if (!native || platform !== "android" || alreadyShown) {
      console.info("[Push] fallback skipped reason=", { native, platform, alreadyShown });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;

      const tryOpen = (consent: string, branch: "auth" | "anonymous") => {
        if (cancelled) return;
        if (sessionStorage.getItem(SESSION_FLAG) === "1") {
          console.info("[Push] fallback skipped reason=race-already-shown source=", source);
          return;
        }
        if (consent !== "unset") {
          console.info(
            "[Push] fallback skipped reason=consent-already-set source=",
            source,
            "branch=",
            branch,
            "consent=",
            consent,
          );
          return;
        }
        sessionStorage.setItem(SESSION_FLAG, "1");
        console.info(
          "[Push] fallback trigger fired source=",
          source,
          "branch=",
          branch,
          "consent=",
          consent,
        );
        setOpen(true);
      };

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user) {
          // Anonymous path — use the local mirror only.
          const localConsent = getLocalPushConsent();
          console.info(
            "[Push] anonymous fallback check source=",
            source,
            "localConsent=",
            localConsent,
          );
          tryOpen(localConsent, "anonymous");
          return;
        }

        // Authenticated path — read profile, fall back to local if row missing.
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("push_consent")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;

        if (error || !data) {
          const localConsent = getLocalPushConsent();
          console.info(
            "[Push] fallback profile-row missing — using local source=",
            source,
            "localConsent=",
            localConsent,
            error,
          );
          tryOpen(localConsent, "auth");
          return;
        }
        const consent = data.push_consent ?? "unset";
        tryOpen(consent, "auth");
      } catch (e) {
        console.warn("[Push] fallback check failed source=", source, e);
      }
    }, INITIAL_DELAY_MS);

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
