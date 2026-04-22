import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Fingerprint } from "lucide-react";
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
      } else if (errMsg.includes("email not confirmed")) {
        toast.error("Please check your email and confirm your account before signing in.");
      } else {
        toast.error(result.error);
      }
    } else if (mode === "signup") {
      toast.success(t("auth.checkEmail"));
    } else {
      // Successful login — record this account for future biometric unlock
      rememberBiometricEmail(email.trim());
      toast.success(t("auth.welcomeBackToast"));
      navigate(returnTo, { replace: true });
    }
  };

  const handleBiometric = async () => {
    const result = await authenticateWithBiometrics();
    if (result.ok) {
      navigate(returnTo, { replace: true });
    } else if (result.error) {
      toast.error(result.error);
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
