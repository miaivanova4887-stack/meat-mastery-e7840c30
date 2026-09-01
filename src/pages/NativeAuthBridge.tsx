import { useEffect, useState } from "react";

/**
 * HTTPS → app handoff bridge for native Google OAuth.
 *
 * Android does NOT deliver a verified https App Link back to the app that
 * opened the Chrome Custom Tab, so the auth server's https callback would
 * otherwise render the web app inside the browser tab. A *page-initiated*
 * navigation to a custom scheme IS delivered to the installed app, so this
 * page immediately bounces to carnivorex://callback carrying the same
 * query/hash (the PKCE code). The app WebView then runs the exchange in
 * /auth/callback, where the code verifier lives.
 *
 * If no app handles the scheme (desktop/web visit), we fall through to the
 * hosted /auth/callback on the same origin so nobody is stranded.
 */

const APP_SCHEME_TARGET = "carnivorex://callback";
const WEB_FALLBACK_MS = 1500;

function buildAppUrl(): string {
  const { search, hash } = window.location;
  return `${APP_SCHEME_TARGET}${search || ""}${hash || ""}`;
}

const NativeAuthBridge = () => {
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    const target = buildAppUrl();
    setAppUrl(target);
    console.info("[oauth:bridge] handing off to app scheme");

    try {
      window.location.replace(target);
    } catch {
      try {
        window.location.href = target;
      } catch {
        /* noop */
      }
    }

    // Web/desktop safety net: if we're still here, the scheme wasn't handled.
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      console.info("[oauth:bridge] scheme not handled, falling back to web callback");
      window.location.replace(
        `${window.location.origin}/auth/callback${window.location.search}${window.location.hash}`,
      );
    }, WEB_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-4">
        <p className="text-base text-foreground">Returning to CarnivoreX…</p>
        {appUrl && (
          <a href={appUrl} className="inline-block text-sm text-primary underline">
            Open CarnivoreX
          </a>
        )}
      </div>
    </div>
  );
};

export default NativeAuthBridge;
