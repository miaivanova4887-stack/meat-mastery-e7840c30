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
 *
 * IMPORTANT: Supabase confirmation emails embed `{{ .TokenHash }}` as the
 * `token` query param of the backend `/auth/v1/verify` URL. That value is
 * the email-link **token hash**, NOT a 6-digit OTP. The SDK requires it to
 * be passed as `{ token_hash, type }`. Passing it as `{ email, token, type }`
 * fails silently for email-link verification.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "verified" | "stale" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** A short numeric OTP code (6-8 digits) is the only case we treat the
   * `token` value as a literal one-time-password; anything longer is the
   * confirmation token hash from the email link. */
  const looksLikeOtpCode = (s: string | undefined): boolean =>
    !!s && /^[0-9]{4,8}$/.test(s);

  const fingerprint = (s: string | undefined): string => {
    if (!s) return "none";
    return `len=${s.length} head=${s.slice(0, 4)}…`;
  };

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

    // If token is a long hex string, it's actually the token hash from the
    // email confirmation URL — promote it.
    if (token && !tokenHash && !looksLikeOtpCode(token)) {
      tokenHash = token;
      token = undefined;
    }

    return { token, tokenHash, type, email };
  };

  const finalize = async () => {
    setStatus("working");
    setErrorMsg(null);
    try {
      console.info("[AuthVerify] callback start url=", window.location.pathname + window.location.search.replace(/(token(?:_hash)?=)[^&]+/g, "$1[redacted]"));

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
      console.info("[AuthVerify] parsed params", {
        hasToken: Boolean(token),
        hasTokenHash: Boolean(tokenHash),
        type,
        hasEmail: Boolean(email),
        tokenFp: fingerprint(token),
        tokenHashFp: fingerprint(tokenHash),
      });

      if ((token || tokenHash) && type) {
        // Prefer token_hash (the canonical email-link verification path).
        const verifyArgs: any = tokenHash
          ? { token_hash: tokenHash, type }
          : { token, type, email };
        console.info("[AuthVerify] verifyOtp call", {
          mode: tokenHash ? "token_hash" : "token+email",
          type,
          hasEmail: Boolean(email),
        });

        const { data, error } = await supabase.auth.verifyOtp(verifyArgs);
        if (error) {
          console.warn("[AuthVerify] verifyOtp error", {
            name: (error as any)?.name,
            status: (error as any)?.status,
            code: (error as any)?.code,
            message: error.message,
          });
          throw error;
        }
        console.info("[AuthVerify] verifyOtp result", {
          hasSession: Boolean(data.session),
          hasUser: Boolean(data.user),
          userVerified: data.user?.email_confirmed_at ?? null,
        });

        if (data.session) {
          // Session installed by SDK; re-confirm and navigate.
          const { data: check } = await supabase.auth.getUser();
          console.info("[AuthVerify] post-verify getUser", {
            verified: check.user?.email_confirmed_at ?? null,
          });
          setStatus("verified");
          toast.success("Email verified — welcome to CarnivoreX");
          window.history.replaceState(null, "", "/auth/callback");
          setTimeout(() => navigate("/", { replace: true }), 600);
          return;
        }

        // Verified but no session — treat as success and route to sign in.
        if (data.user) {
          console.info("[AuthVerify] verified without session, sending to /auth");
          setStatus("verified");
          toast.success("Email verified — please sign in to continue");
          window.history.replaceState(null, "", "/auth/callback");
          setTimeout(() => navigate("/auth", { replace: true }), 800);
          return;
        }
      }

      // 2. Last resort: maybe a session is already installed.
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) console.warn("[AuthVerify] refreshSession error", refreshErr.message);
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
      console.warn("[AuthVerify] callback threw", {
        name: e?.name,
        status: e?.status,
        code: e?.code,
        message: e?.message,
      });
      const code = e?.code as string | undefined;
      let msg = e?.message ?? "Verification failed";
      if (code === "otp_expired" || /expired/i.test(msg)) {
        msg = "This verification link has expired. Please request a new one.";
      }
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  useEffect(() => {
    void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    console.info("[AuthVerify] retry tapped");
    void finalize();
  };

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
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
