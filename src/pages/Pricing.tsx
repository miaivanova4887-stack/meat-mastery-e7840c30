import { ArrowLeft, Check, Crown, Zap, Star, Loader2, ExternalLink } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSubscription, type SubscriptionTier } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const TIERS = {
  pro: {
    monthly: { priceId: "price_1TEtllBqDvgi4jU7lMUy48WX", amount: "$6.99/mo" },
    yearly: { priceId: "price_1TEtmCBqDvgi4jU7Bgdijp8o", amount: "$49.99/yr" },
  },
  elite: {
    monthly: { priceId: "price_1TEtmXBqDvgi4jU7C8P9of8n", amount: "$14.99/mo" },
    yearly: { priceId: "price_1TEtmzBqDvgi4jU7rq0QYLjQ", amount: "$99.99/yr" },
  },
  coaching: { priceId: "price_1TEtnMBqDvgi4jU7ozhwwm9i", amount: "$99.99" },
};

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tier, hasAccess, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Welcome aboard 🎉");
      refreshSubscription();
    }
  }, [searchParams, refreshSubscription]);

  const handleCheckout = async (priceId: string) => {
    if (!user) {
      toast("Please sign in first");
      navigate("/auth");
      return;
    }
    setLoading(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading("portal");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to open portal");
    } finally {
      setLoading(null);
    }
  };

  const plans: {
    tier: SubscriptionTier;
    name: string;
    icon: typeof Star;
    features: string[];
    highlight?: boolean;
  }[] = [
    {
      tier: "free",
      name: "Free",
      icon: Star,
      features: [
        "Basic progress tracking",
        "Ketosis Timer",
        "Full recipe library",
        "My Feed & News",
        "Basic meal logging",
        "EN/FR language toggle",
        "Coaching calls ($99.99/session)",
      ],
    },
    {
      tier: "pro",
      name: "Pro",
      icon: Zap,
      highlight: true,
      features: [
        "Everything in Free",
        "Unlimited meal planning",
        "Advanced progress charts",
        "Full macro history",
        "Community Feed (post & comment)",
        "AI Carnivore Coach chat",
        "Ad-free experience",
        "Data export (CSV)",
        "Personalized recommendations",
        "Coaching calls ($99.99/session)",
      ],
    },
    {
      tier: "elite",
      name: "Elite",
      icon: Crown,
      features: [
        "Everything in Pro",
        "AI Meal Planner",
        "1 coaching call/month included",
        "Priority support",
        "Early access to new features",
        "Hyper-personalized recommendations",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">Choose Your Plan</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-2">
          {(["monthly", "yearly"] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
                billingCycle === cycle ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
              }`}
            >
              {cycle} {cycle === "yearly" && "💰 Save"}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        {plans.map((plan) => {
          const isCurrent = tier === plan.tier;
          const Icon = plan.icon;
          const isUpgrade = !hasAccess(plan.tier);
          const priceInfo = plan.tier !== "free"
            ? TIERS[plan.tier as "pro" | "elite"][billingCycle]
            : null;

          return (
            <div
              key={plan.tier}
              className={`ios-card p-5 relative overflow-hidden transition-all ${
                plan.highlight && !isCurrent ? "ring-2 ring-primary/40" : ""
              } ${isCurrent ? "ring-2 ring-primary" : ""}`}
            >
              {isCurrent && (
                <div className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Your Plan
                </div>
              )}
              {plan.highlight && !isCurrent && (
                <div className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                  Popular
                </div>
              )}

              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  plan.tier === "elite"
                    ? "bg-[hsl(var(--gold))]/15"
                    : plan.tier === "pro"
                    ? "bg-primary/10"
                    : "bg-secondary"
                }`}>
                  <Icon size={18} className={
                    plan.tier === "elite" ? "text-[hsl(var(--gold))]" : plan.tier === "pro" ? "text-primary" : "text-muted-foreground"
                  } />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{plan.name}</h2>
                  {priceInfo ? (
                    <p className="text-sm font-semibold text-primary">{priceInfo.amount}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Always free</p>
                  )}
                </div>
              </div>

              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check size={12} className="text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.tier === "free" ? (
                isCurrent ? null : (
                  <p className="text-xs text-muted-foreground text-center">Current plan</p>
                )
              ) : isCurrent ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handlePortal}
                  disabled={loading === "portal"}
                >
                  {loading === "portal" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  Manage Subscription
                </Button>
              ) : isUpgrade && priceInfo ? (
                <Button
                  className="w-full"
                  onClick={() => handleCheckout(priceInfo.priceId)}
                  disabled={loading === priceInfo.priceId}
                >
                  {loading === priceInfo.priceId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              ) : null}
            </div>
          );
        })}

        {/* Coaching add-on */}
        <div className="ios-card p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--gold))]/15 flex items-center justify-center">
              <Crown size={18} className="text-[hsl(var(--gold))]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">1-Hour Coaching Call</h3>
              <p className="text-xs text-muted-foreground">Available to all plans</p>
            </div>
          </div>
          <p className="text-xs text-foreground/70 mb-3 leading-relaxed">
            Book a 1-on-1 coaching session with a carnivore diet expert.
            {hasAccess("elite") && " Elite members: 1 call/month included — additional sessions at $99.99."}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleCheckout(TIERS.coaching.priceId)}
            disabled={loading === TIERS.coaching.priceId}
          >
            {loading === TIERS.coaching.priceId ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              `Book a Call — ${TIERS.coaching.amount}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
