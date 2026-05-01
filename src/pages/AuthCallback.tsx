import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EmailOtpType =
  | "signup"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change"
  | "email";

/**
 * Landing page hit by the auth verification email link
 * (https://app.carnivorex.app/auth/callback?token=...&type=signup&email=...).
 *
 * On native (Android App Link), the OS routes this URL straight into the app
 * via the intent-filter on MainActivity. On web it loads in the SPA.
 *
 * We verify the token directly with supabase.auth.verifyOtp so we don't have
 * to follow a backend redirect chain (which fails inside Android WebViews).
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "verified" | "stale" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Extract token + type from the current URL. Supports the new direct
   * params and the legacy `verify_url` wrapper for already-sent emails. */
  const extractAuthParams = (): {
    token?: string;
    tokenHash?: string;
    type?: EmailOtpType;
    email?: string;
  } => {
    const search = new URLSearchParams(window.location.search);
    let token = search.get("token") ?? undefined;
    let tokenHash = search.get("token_hash") ?? undefined;
    let type = (search.get("type") as EmailOtpType | null) ?? undefined;
    let email = search.get("email") ?? undefined;

    if ((!token && !tokenHash) || !type) {
      // Legacy: parse verify_url (the Supabase backend verify URL).
      const verifyUrl = search.get("verify_url");
      if (verifyUrl) {
        try {
          const v = new URL(verifyUrl);
          token = token ?? v.searchParams.get("token") ?? undefined;
          tokenHash = tokenHash ?? v.searchParams.get("token_hash") ?? undefined;
          type = type ?? ((v.searchParams.get("type") as EmailOtpType | null) ?? undefined);
        } catch {
          /* noop */
        }
      }
    }

    return { token, tokenHash, type, email };
  };

  const finalize = async () => {
    setStatus("working");
    setErrorMsg(null);
    try {
      console.info("[AuthVerify] callback mount url=", window.location.href);

      // 1. If the URL hash already contains tokens (some flows), supabase-js
      //    will have auto-installed the session. Check first.
      if (window.location.hash.includes("access_token")) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.user?.email_confirmed_at) {
          window.history.replaceState(null, "", "/auth/callback");
          setStatus("verified");
          toast.success("Email verified — welcome to CarnivoreX");
          setTimeout(() => navigate("/", { replace: true }), 600);
          return;
        }
      }

      const { token, tokenHash, type, email } = extractAuthParams();
      console.info("[AuthVerify] params hasToken=", Boolean(token), "hasHash=", Boolean(tokenHash), "type=", type);

      if ((token || tokenHash) && type) {
        // Direct verification — works in WebView with no redirects.
        const verifyArgs: any = tokenHash
          ? { token_hash: tokenHash, type }
          : { token, type, email };
        const { data, error } = await supabase.auth.verifyOtp(verifyArgs);
        if (error) {
          console.warn("[AuthVerify] verifyOtp error", error);
          throw error;
        }
        const verified = data.session?.user?.email_confirmed_at ?? null;
        console.info("[AuthVerify] verifyOtp ok verified=", verified);
        if (data.session) {
          // verifyOtp installs the session automatically, but re-set to be safe.
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          setStatus("verified");
          toast.success("Email verified — welcome to CarnivoreX");
          window.history.replaceState(null, "", "/auth/callback");
          setTimeout(() => navigate("/", { replace: true }), 600);
          return;
        }
      }

      // 2. Last resort: maybe a session is already installed (e.g. user
      //    verified earlier). Refresh and check.
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) console.warn("[AuthVerify] refreshSession error", refreshErr);
      const after = refreshed.session?.user?.email_confirmed_at ?? null;
      console.info("[AuthVerify] fallback session verified=", after);
      if (after) {
        setStatus("verified");
        toast.success("Email verified — welcome to CarnivoreX");
        window.history.replaceState(null, "", "/auth/callback");
        setTimeout(() => navigate("/", { replace: true }), 600);
        return;
      }

      setStatus("stale");
    } catch (e: any) {
      console.warn("[AuthVerify] callback threw", e);
      setErrorMsg(e?.message ?? "Verification failed");
      setStatus("error");
    }
  };

  useEffect(() => {
    void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              onClick={() => void finalize()}
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
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-destructive">{errorMsg ?? "Something went wrong."}</p>
            <button
              onClick={() => void finalize()}
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
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
