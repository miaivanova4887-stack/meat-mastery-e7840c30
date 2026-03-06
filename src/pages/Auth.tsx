import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      toast.error("Please enter a display name");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const result = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, displayName.trim());

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else if (mode === "signup") {
      toast.success("Check your email to confirm your account!");
    } else {
      toast.success("Welcome back!");
      navigate("/");
    }
  };

  const inputClass =
    "w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">
          {mode === "login" ? "Sign In" : "Create Account"}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <span className="text-3xl">🥩</span>
        </div>
        <h2 className="font-display font-bold text-xl text-foreground mb-1">
          {mode === "login" ? "Welcome Back" : "Join the Pack"}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === "login" ? "Sign in to access your community" : "Create your carnivore profile"}
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          {mode === "signup" && (
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                maxLength={50}
                className={inputClass}
              />
            </div>
          )}
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className={inputClass}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "Loading…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-6 text-sm text-muted-foreground"
        >
          {mode === "login" ? (
            <>Don't have an account? <span className="text-primary font-semibold">Sign Up</span></>
          ) : (
            <>Already have an account? <span className="text-primary font-semibold">Sign In</span></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Auth;
