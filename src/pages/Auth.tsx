import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Fingerprint } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { lovable } from "@/integrations/lovable";
import { logAuthDiag } from "@/lib/authDiagnostics";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  isBiometricSupported,
  getRememberedBiometricEmail,
  rememberBiometricEmail,
  authenticateWithBiometrics,
} from "@/lib/biometricAuth";

type Mode = "login" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get("returnTo") || "/";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/";
  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const showApple = Capacitor.getPlatform() === "ios";

  useEffect(() => {
    isBiometricSupported().then((supported) => {
      setBioReady(supported && !!getRememberedBiometricEmail());
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Forgot password flow
    if (mode === "forgot") {
      if (!email.trim()) {
        toast.error(t("auth.fillAllFields"));
        return;
      }
      setLoading(true);
      const result = await resetPassword(email.trim());
      setLoading(false);

      if (result.error) {
        const errMsg = result.error.toLowerCase();
        if (errMsg.includes("user not found") || errMsg.includes("not found")) {
          toast.error(t("auth.noAccountFound"));
        } else {
          toast.error(result.error);
        }
      } else {
        toast.success(t("auth.resetSent"));
        setMode("login");
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error(t("auth.fillAllFields"));
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      toast.error(t("auth.enterDisplayName"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("auth.passwordMin"));
      return;
    }

    setLoading(true);
    const result = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, displayName.trim());

    setLoading(false);

    if (result.error) {
      const errMsg = result.error.toLowerCase();
      if (errMsg.includes("invalid login credentials") || errMsg.includes("invalid_credentials")) {
        toast.error("Incorrect email or password. Please try again.");
        setUnconfirmedEmail(null);
      } else if (errMsg.includes("email not confirmed")) {
        setUnconfirmedEmail(email.trim());
        toast.error(`Please confirm your email first — we sent the link to ${email.trim()}.`);
      } else {
        toast.error(result.error);
        setUnconfirmedEmail(null);
      }
    } else if (mode === "signup") {
      setUnconfirmedEmail(email.trim());
      toast.success(t("auth.checkEmail"));
    } else {
      // Successful login — record this account for future biometric unlock
      rememberBiometricEmail(email.trim());
      toast.success(t("auth.welcomeBackToast"));
      navigate(returnTo, { replace: true });
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setLoading(true);
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    // Web: hosted /auth/callback page runs the PKCE code exchange.
    // Native (android/ios): use the custom URL scheme so the OAuth broker
    // hands the callback directly to the app via the Capacitor intent filter.
    // The HTTPS App Link path was unreliable (resume fired with no session,
    // appUrlOpen never logged), so we route through the custom scheme instead.
    // NOTE: "carnivorex://auth/callback" must be added to the Supabase
    // Auth → URL Configuration → Redirect URLs allowlist.
    const redirectTo =
      platform === "web"
        ? `${window.location.origin}/auth/callback`
        : "carnivorex://auth/callback";
    logAuthDiag("oauth:click", { provider, platform, isNative });
    logAuthDiag("oauth:redirect-uri", { redirectTo });
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: redirectTo,
      });
      logAuthDiag("oauth:signIn-result", {
        provider,
        redirected: Boolean((result as any)?.redirected),
        hasError: Boolean(result.error),
        hasTokens: Boolean((result as any)?.tokens),
        errName: (result.error as any)?.name ?? null,
        errMessage: result.error?.message ?? null,
      });
      if (result.error) {
        toast.error(result.error.message || `${provider === "google" ? "Google" : "Apple"} sign-in failed`);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      logAuthDiag("oauth:signIn-threw", {
        provider,
        name: err?.name ?? null,
        message: err?.message ?? String(err),
      });
      toast.error(`${provider === "google" ? "Google" : "Apple"} sign-in failed`);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => handleOAuthSignIn("google");
  const handleAppleSignIn = () => handleOAuthSignIn("apple");

  const handleBiometric = async () => {
    const result = await authenticateWithBiometrics();
    if (result.ok) {
      navigate(returnTo, { replace: true });
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unconfirmedEmail,
        options: { emailRedirectTo: "https://app.carnivorex.app/auth/callback" },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Confirmation link sent to ${unconfirmedEmail}`);
      }
    } finally {
      setResending(false);
    }
  };

  const headerTitle =
    mode === "login"
      ? t("auth.signIn")
      : mode === "signup"
      ? t("auth.createAccount")
      : t("auth.resetTitle");

  const inputClass =
    "w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">
          {headerTitle}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <span className="text-3xl">{mode === "forgot" ? "🔑" : "🥩"}</span>
        </div>
        <h2 className="font-display font-bold text-xl text-foreground mb-1">
          {mode === "login"
            ? t("auth.welcomeBack")
            : mode === "signup"
            ? t("auth.joinThePack")
            : t("auth.resetTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
          {mode === "login"
            ? t("auth.signInAccess")
            : mode === "signup"
            ? t("auth.createProfile")
            : t("auth.resetSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col space-y-3">
          {mode === "signup" && (
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("auth.displayName")} maxLength={50} className={inputClass} />
            </div>
          )}
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email")} className={inputClass} />
          </div>

          {mode !== "forgot" && (
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.password")} className={`${inputClass} pr-10`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs text-primary/80 self-end hover:text-primary transition-colors"
            >
              {t("auth.forgotPassword")}
            </button>
          )}

          {bioReady && mode === "login" && (
            <button
              type="button"
              onClick={handleBiometric}
              className="w-full py-3 rounded-2xl bg-secondary text-foreground font-semibold text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2 border border-border/40"
            >
              <Fingerprint size={16} />
              {t("auth.signInWithBiometrics")}
            </button>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50">
            {loading
              ? t("auth.loading")
              : mode === "login"
              ? t("auth.signIn")
              : mode === "signup"
              ? t("auth.createAccount")
              : t("auth.sendResetLink")}
          </button>

          {mode !== "forgot" && (
            <>
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-secondary text-foreground font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-3 border border-border/40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              {showApple && (
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-foreground text-background font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.05 12.04c-.03-2.95 2.41-4.36 2.52-4.43-1.37-2.01-3.51-2.28-4.27-2.31-1.82-.18-3.55 1.07-4.47 1.07-.93 0-2.36-1.05-3.88-1.02-2 .03-3.84 1.16-4.87 2.95-2.08 3.6-.53 8.93 1.5 11.85.99 1.43 2.17 3.04 3.71 2.98 1.49-.06 2.05-.96 3.85-.96 1.79 0 2.31.96 3.88.93 1.6-.03 2.62-1.46 3.6-2.9 1.13-1.66 1.6-3.27 1.62-3.36-.04-.02-3.11-1.19-3.14-4.72zM14.16 3.4c.82-.99 1.37-2.37 1.22-3.74-1.18.05-2.6.78-3.45 1.77-.76.87-1.42 2.27-1.24 3.62 1.31.1 2.65-.66 3.47-1.65z"/>
                  </svg>
                  Continue with Apple
                </button>
              )}
            </>
          )}

          {unconfirmedEmail && mode !== "forgot" && (
            <div className="mt-2 px-3 py-3 rounded-xl bg-secondary/60 border border-border/40 text-xs text-muted-foreground text-center space-y-2">
              <p>
                Verification email sent to <span className="text-foreground font-medium">{unconfirmedEmail}</span>.
                Tap the link from this device to finish.
              </p>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="text-primary font-semibold disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend confirmation email"}
              </button>
            </div>
          )}
        </form>

        {mode === "forgot" ? (
          <button
            onClick={() => setMode("login")}
            className="mt-6 text-sm text-muted-foreground"
          >
            <span className="text-primary font-semibold">{t("auth.backToSignIn")}</span>
          </button>
        ) : (
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-6 text-sm text-muted-foreground">
            {mode === "login" ? (
              <>{t("auth.dontHaveAccount")} <span className="text-primary font-semibold">{t("auth.signUp")}</span></>
            ) : (
              <>{t("auth.alreadyHaveAccount")} <span className="text-primary font-semibold">{t("auth.signIn")}</span></>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default Auth;
