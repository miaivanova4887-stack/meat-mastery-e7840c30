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
import { consumeGoogleOAuthInFlight } from "@/lib/oauthFlowState";

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

// Module-level guards so duplicate hook mounts / repeated callback navigation
// cannot reprocess the same launch URL or the same OAuth fragment over and
// over (which previously triggered iOS's history.replaceState rate limit).
let launchUrlProcessed = false;
let lastHandledAuthFp: string | null = null;
let lastHandledAt = 0;
const DEDUPE_WINDOW_MS = 10_000;
let browserCloseAttempted = false;

function authCallbackFingerprint(rawUrl: string): string {
  // Use the token / code portion as the dedupe key — the URL itself is
  // identical across cold + live + remount events.
  const hashIdx = rawUrl.indexOf("#");
  const qIdx = rawUrl.indexOf("?");
  if (hashIdx >= 0) return "h:" + rawUrl.slice(hashIdx + 1, hashIdx + 96);
  if (qIdx >= 0) return "q:" + rawUrl.slice(qIdx + 1, qIdx + 96);
  return "u:" + rawUrl.slice(0, 96);
}

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

        // Dedupe: ignore the same auth callback fingerprint within the window.
        const fp = authCallbackFingerprint(rawUrl);
        const now = Date.now();
        if (lastHandledAuthFp === fp && now - lastHandledAt < DEDUPE_WINDOW_MS) {
          logAuthDiag("deeplink:dedupe-skip", { source, ageMs: now - lastHandledAt });
          return;
        }
        lastHandledAuthFp = fp;
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
          // Only try to close the in-app browser once per callback —
          // otherwise we spam "No active window to close!" errors.
          if (!browserCloseAttempted) {
            browserCloseAttempted = true;
            void Browser.close()
              .then(() => logAuthDiag("oauth:browser-close"))
              .catch((e) =>
                logAuthDiag("oauth:browser-close-error", { error: String(e) }),
              );
          }
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

    // Only consume the iOS launch URL once per process. iOS keeps returning
    // the same URL on every call, so without this guard every remount of
    // AuthCallback re-routes to /callback and loops setSession+replaceState.
    if (!launchUrlProcessed) {
      launchUrlProcessed = true;
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
      logAuthDiag("deeplink:launch-url-skip-already-processed");
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
