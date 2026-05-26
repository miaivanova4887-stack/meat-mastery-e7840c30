import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  logAuthDiag,
  fingerprint,
  formatAuthDiag,
  copyAuthDiagToClipboard,
  redactUrl,
} from "@/lib/authDiagnostics";
import {
  beginAuthCallback,
  endAuthCallback,
  callbackFingerprint,
  isCallbackCompleted,
  markCallbackCompleted,
  consumeCallbackHandoff,
  clearCallbackHandoff,
} from "@/lib/authCallbackGuard";

// In-runtime guard ONLY — the source of truth is the persistent
// isCallbackCompleted() check (localStorage with TTL).
let isFinalizing = false;
let cleanedOnce = false;

function cleanAuthParamsFromUrl() {
  // Only ever attempt this once per runtime to stay well clear of the iOS
  // "history.replaceState() more than 100 times per 10 seconds" limit.
  if (cleanedOnce) return;
  if (!window.location.hash && !window.location.search) {
    cleanedOnce = true;
    return;
  }
  if (
    !/access_token|refresh_token|token_hash|[?&]code=/.test(
      window.location.hash + window.location.search,
    )
  ) {
    cleanedOnce = true;
    return;
  }
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* iOS replaceState rate limit — swallow */
  }
  cleanedOnce = true;
}

/**
 * Accepted callback formats (any one is enough to install a session):
 *   - carnivorex://callback#access_token=...&refresh_token=...
 *   - carnivorex:///callback#access_token=...&refresh_token=...
 *   - carnivorex://auth/callback#access_token=...&refresh_token=...
 *   - https://app.carnivorex.app/auth/callback?code=... (PKCE web flow)
 *
 * Expected good log sequence:
 *   [BuildInfo] ... authFlow=v8-normalized-callback-parser
 *   oauth:redirect-uri {"redirectTo":"carnivorex://callback"}
 *   deeplink:appUrlOpen ...
 *   deeplink:received ... "normalizedPath":"/callback","isAuthRoute":true
 *   callback:setSession-start
 *   callback:setSession-success
 *   navigation to /
 */

type EmailOtpType =
  | "signup"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change"
  | "email";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "verified" | "stale" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [diagText, setDiagText] = useState("");
  // Preserve the original URL so Retry still works after replaceState clears params.
  // Prefer the raw native URL handed off by useDeepLinks (token fragment is NOT
  // written into the visible WebView address anymore), and fall back to
  // window.location.href for the email/web flow.
  const originalUrlRef = useRef<string>(consumeCallbackHandoff() ?? window.location.href);

  const looksLikeOtpCode = (s: string | undefined): boolean =>
    !!s && /^[0-9]{4,8}$/.test(s);

  const extractAuthParams = (sourceUrl: string) => {
    let token: string | undefined;
    let tokenHash: string | undefined;
    let type: EmailOtpType | undefined;
    let email: string | undefined;
    try {
      const u = new URL(sourceUrl);
      const search = u.searchParams;
      token = search.get("token") ?? undefined;
      tokenHash = search.get("token_hash") ?? undefined;
      type = (search.get("type") as EmailOtpType | null) ?? undefined;
      email = search.get("email") ?? undefined;

      if ((!token && !tokenHash) || !type) {
        const verifyUrl = search.get("verify_url");
        if (verifyUrl) {
          try {
            const v = new URL(verifyUrl);
            token = token ?? v.searchParams.get("token") ?? undefined;
            tokenHash = tokenHash ?? v.searchParams.get("token_hash") ?? undefined;
            type = type ?? ((v.searchParams.get("type") as EmailOtpType | null) ?? undefined);
          } catch {/* noop */}
        }
      }
      if (token && !tokenHash && !looksLikeOtpCode(token)) {
        tokenHash = token;
        token = undefined;
      }
    } catch (e) {
      logAuthDiag("callback:parse-url-error", { error: String(e) });
    }
    return { token, tokenHash, type, email };
  };

  const finalize = async () => {
    const sourceUrl = originalUrlRef.current;
    const fp = callbackFingerprint(sourceUrl);
    if (isFinalizing) {
      logAuthDiag("callback:skip-already-finalizing", { fp });
      return;
    }
    // Persistent guard — survives WebView/runtime resets.
    if (isCallbackCompleted(fp)) {
      logAuthDiag("callback:skip-persistent-completed", { fp });
      clearCallbackHandoff();
      setStatus("verified");
      setTimeout(() => navigate("/", { replace: true }), 50);
      return;
    }
    isFinalizing = true;
    setStatus("working");
    setErrorMsg(null);
    logAuthDiag("callback:start", {
      url: redactUrl(sourceUrl),
      hashHasAccessToken: window.location.hash.includes("access_token"),
    });

    beginAuthCallback();
    try {
      // 0a. Hash/query token install — native OAuth callback returns
      //     #access_token=...&refresh_token=... directly. Install the session
      //     IMMEDIATELY rather than waiting on resume/refreshSession (which
      //     races and logs "Auth session missing!").
      let access_token: string | null = null;
      let refresh_token: string | null = null;
      try {
        const u = new URL(sourceUrl);
        const fromHash = new URLSearchParams(
          (u.hash || window.location.hash || "").replace(/^#/, ""),
        );
        const fromQuery = u.searchParams;
        access_token = fromHash.get("access_token") || fromQuery.get("access_token");
        refresh_token = fromHash.get("refresh_token") || fromQuery.get("refresh_token");
      } catch { /* noop */ }

      if (access_token && refresh_token) {
        logAuthDiag("callback:setSession-start", {
          accessTokenFp: fingerprint(access_token),
          refreshTokenFp: fingerprint(refresh_token),
        });
        const { data: ssData, error: ssErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (ssErr || !ssData?.session) {
          logAuthDiag("callback:setSession-error", {
            errName: (ssErr as any)?.name ?? null,
            errMessage: ssErr?.message ?? null,
            hasSession: Boolean(ssData?.session),
          });
          throw ssErr ?? new Error("setSession returned no session");
        }
        logAuthDiag("callback:setSession-success", {
          hasUser: Boolean(ssData.user),
          userVerified: ssData.user?.email_confirmed_at ?? null,
        });
        cleanAuthParamsFromUrl();
        setStatus("verified");
        toast.success("Signed in — welcome to CarnivoreX");
        setTimeout(() => navigate("/", { replace: true }), 400);
        endAuthCallback();
        return;
      }

      // 0. OAuth (PKCE) code exchange — Google/Apple sign-in returns ?code=...
      let oauthCode: string | null = null;
      try {
        oauthCode = new URL(sourceUrl).searchParams.get("code");
      } catch { /* noop */ }
      if (oauthCode) {
        logAuthDiag("oauth:exchange-call", {
          hasCode: true,
          codeFp: fingerprint(oauthCode),
        });
        const { data: exData, error: exErr } =
          await supabase.auth.exchangeCodeForSession(sourceUrl);
        logAuthDiag("oauth:exchange-result", {
          hasSession: Boolean(exData?.session),
          hasUser: Boolean(exData?.user),
          userVerified: exData?.user?.email_confirmed_at ?? null,
          errName: (exErr as any)?.name ?? null,
          errStatus: (exErr as any)?.status ?? null,
          errCode: (exErr as any)?.code ?? null,
          errMessage: exErr?.message ?? null,
        });
        if (!exErr && exData?.session) {
          cleanAuthParamsFromUrl();
          setStatus("verified");
          toast.success("Signed in — welcome to CarnivoreX");
          setTimeout(() => navigate("/", { replace: true }), 600);
          return;
        }
        if (exErr) throw exErr;
      }

      // 1. Hash-style session install (OAuth/legacy).
      if (window.location.hash.includes("access_token")) {
        const { data: refreshed, error: refErr } = await supabase.auth.refreshSession();
        logAuthDiag("callback:hash-refresh", {
          hasSession: Boolean(refreshed.session),
          verified: refreshed.session?.user?.email_confirmed_at ?? null,
          error: refErr?.message ?? null,
        });
        if (refreshed.session?.user?.email_confirmed_at) {
          cleanAuthParamsFromUrl();
          setStatus("verified");
          toast.success("Email verified — welcome to CarnivoreX");
          setTimeout(() => navigate("/", { replace: true }), 600);
          return;
        }
      }

      const { token, tokenHash, type, email } = extractAuthParams(sourceUrl);
      logAuthDiag("callback:parsed", {
        hasToken: Boolean(token),
        hasTokenHash: Boolean(tokenHash),
        type,
        hasEmail: Boolean(email),
        tokenFp: fingerprint(token),
        tokenHashFp: fingerprint(tokenHash),
      });

      if ((token || tokenHash) && type) {
        const mode = tokenHash ? "token_hash" : "token+email";
        const verifyArgs: any = tokenHash
          ? { token_hash: tokenHash, type }
          : { token, type, email };
        logAuthDiag("callback:verifyOtp-call", { mode, type, hasEmail: Boolean(email) });

        const { data, error } = await supabase.auth.verifyOtp(verifyArgs);
        logAuthDiag("callback:verifyOtp-result", {
          mode,
          hasSession: Boolean(data?.session),
          hasUser: Boolean(data?.user),
          userVerified: data?.user?.email_confirmed_at ?? null,
          errName: (error as any)?.name ?? null,
          errStatus: (error as any)?.status ?? null,
          errCode: (error as any)?.code ?? null,
          errMessage: error?.message ?? null,
        });
        if (error) throw error;

        if (data.session) {
          const { data: check, error: getErr } = await supabase.auth.getUser();
          logAuthDiag("callback:getUser", {
            verified: check.user?.email_confirmed_at ?? null,
            error: getErr?.message ?? null,
          });
          setStatus("verified");
          toast.success("Email verified — welcome to CarnivoreX");
          cleanAuthParamsFromUrl();
          setTimeout(() => navigate("/", { replace: true }), 600);
          return;
        }

        if (data.user) {
          logAuthDiag("callback:verified-no-session");
          setStatus("verified");
          toast.success("Email verified — please sign in to continue");
          cleanAuthParamsFromUrl();
          setTimeout(() => navigate("/auth", { replace: true }), 800);
          return;
        }
      } else {
        logAuthDiag("callback:no-params");
      }

      // 2. Last resort
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      logAuthDiag("callback:fallback-refresh", {
        hasSession: Boolean(refreshed.session),
        verified: refreshed.session?.user?.email_confirmed_at ?? null,
        error: refreshErr?.message ?? null,
      });
      if (refreshed.session?.user?.email_confirmed_at) {
        setStatus("verified");
        toast.success("Email verified — welcome to CarnivoreX");
        cleanAuthParamsFromUrl();
        setTimeout(() => navigate("/", { replace: true }), 600);
        return;
      }

      setStatus("stale");
    } catch (e: any) {
      logAuthDiag("callback:threw", {
        name: e?.name ?? null,
        status: e?.status ?? null,
        code: e?.code ?? null,
        message: e?.message ?? null,
      });
      const code = e?.code as string | undefined;
      let msg = e?.message ?? "Verification failed";
      if (code === "otp_expired" || /expired/i.test(msg)) {
        msg = "This verification link has expired. Please request a new one.";
      }
      setErrorMsg(msg);
      setStatus("error");
    } finally {
      isFinalizing = false;
      endAuthCallback();
    }
  };

  useEffect(() => {
    void finalize();
    // 8-second failsafe so the app NEVER sits on indefinite Loading.
    const failsafe = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev === "working") {
          logAuthDiag("callback:failsafe-timeout");
          setErrorMsg("Sign-in is taking longer than expected. Please retry or return to sign in.");
          endAuthCallback();
          return "error";
        }
        return prev;
      });
    }, 8000);
    return () => window.clearTimeout(failsafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open diagnostics when verification doesn't succeed so the user
  // can immediately copy/share the redacted log without extra taps.
  useEffect(() => {
    if (status === "stale" || status === "error") {
      setDiagText(formatAuthDiag());
      setShowDiag(true);
    }
  }, [status]);

  const handleRetry = () => {
    logAuthDiag("callback:retry");
    // Allow finalize() to re-run for the same URL on explicit user retry.
    lastFinalizedFp = null;
    void finalize();
  };

  const handleShowDiag = () => {
    setDiagText(formatAuthDiag());
    setShowDiag(true);
  };

  const handleCopy = async () => {
    const ok = await copyAuthDiagToClipboard();
    if (ok) toast.success("Diagnostics copied");
    else toast.error("Couldn’t copy — long-press the text below to copy");
  };

  const renderDiagPanel = () => (
    <div className="mt-6 text-left">
      <div className="text-[10px] font-mono text-muted-foreground mb-2 break-all">
        url: {redactUrl(originalUrlRef.current)}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleShowDiag}
          className="text-xs underline text-muted-foreground"
        >
          {showDiag ? "Refresh diagnostics" : "Show diagnostics"}
        </button>
        {showDiag && (
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 rounded-md bg-secondary text-foreground border border-border/40"
          >
            Copy
          </button>
        )}
      </div>
      {showDiag && (
        <textarea
          readOnly
          value={diagText}
          className="w-full h-56 text-[10px] font-mono p-2 rounded-md bg-secondary text-foreground border border-border/40"
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
          🥩
        </div>
        <h1 className="font-display font-bold text-xl">CarnivoreX</h1>
        {status === "working" && (
          <p className="text-sm text-muted-foreground">Activating your account…</p>
        )}
        {status === "verified" && (
          <p className="text-sm text-muted-foreground">Verified! Redirecting…</p>
        )}
        {status === "stale" && (
          <>
            <p className="text-sm text-muted-foreground">
              We couldn’t confirm your verification yet. Tap below to try again.
            </p>
            <button
              onClick={handleRetry}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              Retry verification
            </button>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="text-xs text-muted-foreground underline"
            >
              Back to sign in
            </button>
            {renderDiagPanel()}
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-destructive">{errorMsg ?? "Something went wrong."}</p>
            <button
              onClick={handleRetry}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              Try again
            </button>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="text-xs text-muted-foreground underline"
            >
              Back to sign in
            </button>
            {renderDiagPanel()}
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
