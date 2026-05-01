import { ArrowLeft, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Direct verification: parse token + type from email link query params.
    // Falls back to a wrapped verify_url for older recovery emails.
    const verifyRecoveryToken = async () => {
      const search = new URLSearchParams(window.location.search);
      let token = search.get("token") ?? undefined;
      let tokenHash = search.get("token_hash") ?? undefined;
      let type = (search.get("type") ?? undefined) as
        | "recovery"
        | "magiclink"
        | "email"
        | undefined;
      const email = search.get("email") ?? undefined;

      if ((!token && !tokenHash) || !type) {
        const verifyUrl = search.get("verify_url");
        if (verifyUrl) {
          try {
            const v = new URL(verifyUrl);
            token = token ?? v.searchParams.get("token") ?? undefined;
            tokenHash = tokenHash ?? v.searchParams.get("token_hash") ?? undefined;
            type =
              type ??
              ((v.searchParams.get("type") ?? undefined) as
                | "recovery"
                | "magiclink"
                | "email"
                | undefined);
          } catch {
            /* noop */
          }
        }
      }

      // Long hex `token` values from email links are actually the token hash.
      if (token && !tokenHash && !/^[0-9]{4,8}$/.test(token)) {
        tokenHash = token;
        token = undefined;
      }

      if ((token || tokenHash) && type) {
        const args: any = tokenHash
          ? { token_hash: tokenHash, type }
          : { token, type, email };
        console.info("[ResetPassword] verifyOtp call", {
          mode: tokenHash ? "token_hash" : "token+email",
          type,
          hasEmail: Boolean(email),
        });
        const { data, error } = await supabase.auth.verifyOtp(args);
        if (error) {
          console.warn("[ResetPassword] verifyOtp error", {
            name: (error as any)?.name,
            status: (error as any)?.status,
            code: (error as any)?.code,
            message: error.message,
          });
          toast.error(error.message || "Reset link invalid or expired");
          return;
        }
        if (data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          setRecoveryReady(true);
          window.history.replaceState(null, "", "/reset-password");
          return;
        }
      }

      // Existing session may already be in recovery mode
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setRecoveryReady(true);
    };

    void verifyRecoveryToken();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setRecoveryReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !confirmPassword.trim()) {
      toast.error(t("auth.fillAllFields"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("auth.passwordMin"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsDontMatch"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.passwordUpdated"));
      navigate("/", { replace: true });
    }
  };

  const inputClass =
    "w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">
          {t("auth.resetTitle")}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <span className="text-3xl">🔑</span>
        </div>
        <h2 className="font-display font-bold text-xl text-foreground mb-1">
          {t("auth.resetTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
          {recoveryReady
            ? t("auth.enterNewPassword")
            : t("auth.waitingForRecovery")}
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.newPassword")}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("auth.confirmPassword")}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? t("auth.loading") : t("auth.updatePassword")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
