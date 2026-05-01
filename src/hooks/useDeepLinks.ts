import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wires native deep-link handling for Android App Links.
 *
 * - On `appUrlOpen`: parse the URL, and if it points at /auth/callback, push
 *   the path (with hash) into React Router so AuthCallback can finalize.
 * - On `resume`: refresh the Supabase session in case the user verified in a
 *   browser tab and is returning to the app.
 */
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const urlOpenSub = CapApp.addListener("appUrlOpen", (event) => {
      try {
        console.info("[AuthVerify] native deep link received url=", event.url);
        const url = new URL(event.url);
        if (
          url.pathname.startsWith("/auth/callback") ||
          url.pathname.startsWith("/reset-password")
        ) {
          // Preserve the hash so supabase-js can read the tokens.
          const target = `${url.pathname}${url.search}${url.hash}`;
          // Mirror the hash onto window.location so getSession() picks it up.
          if (url.hash) {
            window.history.replaceState(null, "", target);
          }
          navigate(target, { replace: true });
        }
      } catch (e) {
        console.warn("[AuthVerify] failed to parse deep link", e);
      }
    });

    const resumeSub = CapApp.addListener("resume", () => {
      console.info("[AuthVerify] app resumed, refreshing session");
      void supabase.auth.refreshSession().then(({ data, error }) => {
        if (error) {
          console.warn("[AuthVerify] resume refresh error", error);
          return;
        }
        const verified = data.session?.user?.email_confirmed_at ?? null;
        console.info("[AuthVerify] resume refresh done verified=", verified);
      });
    });

    return () => {
      void urlOpenSub.then((s) => s.remove());
      void resumeSub.then((s) => s.remove());
    };
  }, [navigate]);
}
