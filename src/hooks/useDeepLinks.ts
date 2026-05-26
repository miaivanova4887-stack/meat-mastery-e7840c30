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
  callbackFingerprint,
  isCallbackCompleted,
  storeCallbackHandoff,
} from "@/lib/authCallbackGuard";
import { consumeGoogleOAuthInFlight } from "@/lib/oauthFlowState";

/**
 * Wires native deep-link handling.
 *
 * v10 changes (persistent callback guard):
 *  - dedupe lives in localStorage so a WebView reload cannot reset it
 *  - the raw native callback URL is handed off via sessionStorage to
 *    AuthCallback INSTEAD of writing the token fragment into the visible
 *    WebView address with history.replaceState (which caused the iOS
 *    "history.replaceState() more than 100 times per 10 seconds" loop)
 *  - on a completed/duplicate callback we navigate to "/" and skip routing
 *    back into /callback entirely
 */

// In-runtime guard for the very first appUrlOpen burst — the persistent
// guard handles cross-runtime safety; this just avoids redundant work.
let lastHandledFp: string | null = null;
let lastHandledAt = 0;
const SHORT_DEDUPE_WINDOW_MS = 10_000;
let browserCloseAttempted = false;
let launchUrlConsumed = false;

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

        const fp = callbackFingerprint(rawUrl);

        // Persistent dedupe — survives WebView/runtime reloads.
        if (isCallbackCompleted(fp)) {
          logAuthDiag("deeplink:persistent-completed-skip", { source, fp });
          // Make sure we land on home and not on /callback if the runtime
          // somehow restarted on a token-bearing URL.
          if (
            window.location.pathname === "/callback" ||
            window.location.pathname === "/auth/callback"
          ) {
            navigate("/", { replace: true });
          }
          return;
        }

        // Short in-runtime dedupe for rapid duplicate appUrlOpen events.
        const now = Date.now();
        if (lastHandledFp === fp && now - lastHandledAt < SHORT_DEDUPE_WINDOW_MS) {
          logAuthDiag("deeplink:short-dedupe-skip", { source, ageMs: now - lastHandledAt });
          return;
        }
        lastHandledFp = fp;
        lastHandledAt = now;

        const isOAuthCallback =
          parsed.normalizedPath === "/callback" ||
          parsed.normalizedPath === "/auth/callback";

        if (isOAuthCallback) {
          const googleFlow = consumeGoogleOAuthInFlight();
          if (googleFlow.wasInFlight) {
            logAuthDiag("oauth:google-callback", {
              normalizedPath: parsed.normalizedPath,
              ageMs: googleFlow.ageMs,
            });
          }
          if (!browserCloseAttempted) {
            browserCloseAttempted = true;
            void Browser.close()
              .then(() => logAuthDiag("oauth:browser-close"))
              .catch((e) =>
                logAuthDiag("oauth:browser-close-error", { error: String(e) }),
              );
          }
        }

        // Hand off the raw URL via sessionStorage so AuthCallback can
        // process tokens WITHOUT us first writing them into the visible
        // WebView address. This eliminates the replaceState loop.
        storeCallbackHandoff(rawUrl);
        logAuthDiag("deeplink:handoff-stored", { fp, normalizedPath: parsed.normalizedPath });

        // Navigate to the clean callback path — no hash, no search, no
        // history.replaceState with token fragments.
        navigate(parsed.normalizedPath, { replace: true });
      } catch (e) {
        logAuthDiag("deeplink:parse-error", { error: String(e) });
      }
    };

    if (!launchUrlConsumed) {
      launchUrlConsumed = true;
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
    } else {
      logAuthDiag("deeplink:launch-url-skip-already-consumed");
    }

    const urlOpenSub = CapApp.addListener("appUrlOpen", (event) => {
      logAuthDiag("deeplink:appUrlOpen", { redacted: redactUrl(event.url) });
      routeAuthUrl(event.url, "live");
    });

    const resumeSub = CapApp.addListener("resume", () => {
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
