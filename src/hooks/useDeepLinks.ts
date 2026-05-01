import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { logAuthDiag, redactUrl } from "@/lib/authDiagnostics";
import {
  isAuthCallbackInProgress,
  normalizeAuthCallbackUrl,
} from "@/lib/authCallbackGuard";

/**
 * Wires native deep-link handling for Android App Links + custom scheme.
 *
 * Accepted native OAuth callback shapes (all normalized to an auth route):
 *   - carnivorex://callback#access_token=...
 *   - carnivorex:///callback#access_token=...
 *   - carnivorex://auth/callback#access_token=...
 *
 * Required Supabase Auth → URL Configuration → Redirect URLs allowlist:
 *   - carnivorex://callback
 *   - carnivorex://auth/callback
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
        const parsed = normalizeAuthCallbackUrl(rawUrl);
        logAuthDiag("deeplink:received", {
          source,
          protocol: parsed.protocol,
          host: parsed.host,
          pathname: parsed.pathname,
          normalizedPath: parsed.normalizedPath,
          isAuthRoute: parsed.isAuthRoute,
          redacted: redactUrl(rawUrl),
        });
        if (!parsed.isAuthRoute) return;
        const isOAuthCallback =
          parsed.normalizedPath === "/callback" ||
          parsed.normalizedPath === "/auth/callback";
        if (isOAuthCallback) {
          void Browser.close()
            .then(() => logAuthDiag("oauth:browser-close"))
            .catch((e) =>
              logAuthDiag("oauth:browser-close-error", { error: String(e) }),
            );
        }
        const target = `${parsed.normalizedPath}${parsed.search}${parsed.hash}`;
        if (parsed.hash) {
          window.history.replaceState(null, "", target);
        }
        navigate(target, { replace: true });
      } catch (e) {
        logAuthDiag("deeplink:parse-error", { error: String(e) });
      }
    };

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
      // Skip resume-time refresh while AuthCallback is actively installing
      // a session — otherwise refreshSession() races setSession() and logs
      // "Auth session missing!" which corrupts the loading state.
      if (isAuthCallbackInProgress()) {
        logAuthDiag("deeplink:resume-skip-callback-in-progress");
        return;
      }
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
