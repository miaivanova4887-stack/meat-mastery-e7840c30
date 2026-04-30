import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Landing page hit by the auth verification email link
 * (https://carnivorex.app/auth/callback#access_token=...).
 *
 * On native (Android App Link), the OS routes this URL straight into the app
 * via the intent-filter on MainActivity. On web it simply loads in the SPA.
 *
 * Either way we let supabase-js pick the tokens out of the URL hash, then
 * force a session refresh so `email_confirmed_at` is up to date.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "verified" | "stale" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const finalize = async () => {
    setStatus("working");
    try {
      console.info("[AuthVerify] callback mount url=", window.location.href);

      // supabase-js auto-parses tokens from window.location.hash on load,
      // but make sure we trigger the session install before refreshing.
      const { data: sessionData } = await supabase.auth.getSession();
      const before = sessionData.session?.user?.email_confirmed_at ?? null;
      console.info("[AuthVerify] session before refresh verified=", before);

      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.warn("[AuthVerify] refreshSession error", refreshErr);
      }
      const after = refreshed.session?.user?.email_confirmed_at ?? null;
      console.info("[AuthVerify] session after refresh verified=", after);

      if (after) {
        setStatus("verified");
        toast.success("Email verified — welcome to CarnivoreX");
        // Clean the hash and bounce home.
        window.history.replaceState(null, "", "/auth/callback");
        setTimeout(() => navigate("/", { replace: true }), 600);
      } else {
        setStatus("stale");
      }
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
              We couldn’t confirm your verification yet. Tap below to refresh.
            </p>
            <button
              onClick={() => void finalize()}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              Refresh verification status
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
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
