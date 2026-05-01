import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { logAuthDiag, redactUrl } from "@/lib/authDiagnostics";

/**
 * Wires native deep-link handling for Android App Links.
 *
 * Two delivery paths exist on Android:
 *  - "live link"  : app already running -> appUrlOpen event fires.
 *  - "cold start" : app launched by the link -> URL is on getLaunchUrl(),
 *                   and the appUrlOpen listener may attach AFTER the
 *                   intent fired, so we have to read launch URL ourselves.
 */
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      logAuthDiag("deeplink:web-skip", { href: redactUrl(window.location.href) });
      return;
    }

    const routeAuthUrl = (rawUrl: string, source: "live" | "cold") => {
      try {
        const url = new URL(rawUrl);
        const isOAuthCallback =
          url.pathname.startsWith("/auth/callback") ||
          url.pathname.startsWith("/callback");
        const isAuth = isOAuthCallback || url.pathname.startsWith("/reset-password");
        logAuthDiag("deeplink:received", {
          source,
          pathname: url.pathname,
          isAuthRoute: isAuth,
          redacted: redactUrl(rawUrl),
        });
        if (!isAuth) return;
        // Close the in-app browser opened for OAuth so the app comes to the
        // foreground while the callback finishes the PKCE exchange.
        if (isOAuthCallback) {
          void Browser.close()
            .then(() => logAuthDiag("oauth:browser-close"))
            .catch((e) =>
              logAuthDiag("oauth:browser-close-error", { error: String(e) }),
            );
        }
        const target = `${url.pathname}${url.search}${url.hash}`;
        if (url.hash) {
          window.history.replaceState(null, "", target);
        }
        navigate(target, { replace: true });
      } catch (e) {
        logAuthDiag("deeplink:parse-error", { error: String(e) });
      }
    };

    // Cold-start: capture the launch URL even if appUrlOpen never fires
    // because the listener attached too late.
    void CapApp.getLaunchUrl()
      .then((res) => {
        if (res?.url) {
          logAuthDiag("deeplink:launch-url", { redacted: redactUrl(res.url) });
          routeAuthUrl(res.url, "cold");
        } else {
          logAuthDiag("deeplink:launch-url-empty");
        }
      })
      .catch((e) => logAuthDiag("deeplink:launch-url-error", { error: String(e) }));

    const urlOpenSub = CapApp.addListener("appUrlOpen", (event) => {
      logAuthDiag("deeplink:appUrlOpen", { redacted: redactUrl(event.url) });
      routeAuthUrl(event.url, "live");
    });

    const resumeSub = CapApp.addListener("resume", () => {
      logAuthDiag("deeplink:resume-refresh");
      void supabase.auth.refreshSession().then(({ data, error }) => {
        if (error) {
          logAuthDiag("deeplink:resume-refresh-error", { message: error.message });
          return;
        }
        logAuthDiag("deeplink:resume-refresh-done", {
          verified: data.session?.user?.email_confirmed_at ?? null,
          hasSession: Boolean(data.session),
        });
      });
    });

    return () => {
      void urlOpenSub.then((s) => s.remove());
      void resumeSub.then((s) => s.remove());
    };
  }, [navigate]);
}
