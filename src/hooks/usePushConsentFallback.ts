// Push consent fallback hook.
// Decoupled from onboarding completion: shows the consent sheet once per
// browser session for native Android users whose profiles.push_consent is
// still 'unset' and who already have a signed-in profile loaded.
//
// Mount on multiple pages (Home, Profile) so users who skipped onboarding
// still get prompted. The shared sessionStorage flag prevents double-prompts
// across pages within the same session.

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const SESSION_FLAG = "push-prompt-shown";
// Short delay so onboarding-triggered sheet wins on the same launch.
const INITIAL_DELAY_MS = 600;

export type PushFallbackSource = "home" | "profile";

export function usePushConsentFallback(source: PushFallbackSource) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          console.info("[Push] fallback skipped reason=no-signed-in-user source=", source);
          return;
        }
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("push_consent")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          console.info("[Push] fallback skipped reason=no-profile-row source=", source, error);
          return;
        }
        const consent = data.push_consent ?? "unset";
        // Re-check session flag in case the other page mounted simultaneously.
        if (sessionStorage.getItem(SESSION_FLAG) === "1") {
          console.info("[Push] fallback skipped reason=race-already-shown source=", source);
          return;
        }
        if (consent !== "unset") {
          console.info("[Push] fallback skipped reason=consent-already-set source=", source, "consent=", consent);
          return;
        }
        sessionStorage.setItem(SESSION_FLAG, "1");
        console.info("[Push] fallback trigger fired source=", source, "consent=", consent);
        setOpen(true);
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
