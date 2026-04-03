import { ArrowLeft, Crown, ExternalLink, Loader2, LogIn } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

const Coaching = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAccess } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const isElite = hasAccess("elite");

  const handleBookPaid = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate(`/auth?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-coaching-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">Coaching</h1>
      </div>

      <div className="px-4 pt-6 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--gold))]/15 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Crown size={28} className="text-[hsl(var(--gold))]" />
          </div>
          <h2 className="text-xl font-bold text-foreground">1-on-1 Expert Coaching</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            Get personalized guidance from a carnivore diet expert in a private 1-hour video call.
          </p>
        </div>

        <div className="ios-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">What you'll get:</h3>
          <ul className="space-y-2 text-xs text-foreground/80">
            {[
              "Personalized meal plan review",
              "Troubleshooting stalls or symptoms",
              "Supplement & lifestyle recommendations",
              "Goal-specific strategy (weight loss, performance, healing)",
              "Follow-up summary notes via email",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {isElite ? (
          <div className="ios-card p-5 border-[hsl(var(--gold))]/30 border">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={14} className="text-[hsl(var(--gold))]" />
              <span className="text-xs font-bold text-[hsl(var(--gold))] uppercase tracking-wider">Elite Member</span>
            </div>
            <p className="text-sm text-foreground mb-3">
              You have <strong>1 coaching call/month included</strong> with your Elite plan.
            </p>
            <Button className="w-full gap-2" onClick={() => toast.info("Calendly booking link coming soon!")}>
              <ExternalLink size={14} />
              Book Your Free Call
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Additional calls: $99.99/session
            </p>
          </div>
        ) : (
          <div className="ios-card p-5">
            <div className="text-center mb-3">
              <p className="text-2xl font-bold text-foreground">$99.99</p>
              <p className="text-xs text-muted-foreground">per 1-hour session</p>
            </div>
            {!user ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-center">
                <p className="text-sm font-medium text-foreground">
                  Please sign in or create your account before booking a coaching call.
                </p>
                <p className="text-xs text-muted-foreground">
                  Booking and payment for coaching calls require an account so we can link your session and payment correctly.
                </p>
                <Button className="w-full gap-2 mt-2" onClick={() => navigate("/auth", { state: { from: location } })}>
                  <LogIn size={14} />
                  Sign In / Create Account
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={handleBookPaid}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Book & Pay"}
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Elite members get 1 call/month included.{" "}
              <button onClick={() => navigate("/pricing")} className="text-primary underline">
                Upgrade →
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Coaching;
