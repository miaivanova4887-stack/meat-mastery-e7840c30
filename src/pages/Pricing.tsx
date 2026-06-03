import { ArrowLeft, Check, Crown, Zap, Star, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSubscription, type SubscriptionTier } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNativePaywall, type NativePackageInfo } from "@/hooks/useNativePaywall";

// --- Web / Stripe configuration ------------------------------------------
// These price IDs drive Stripe Checkout on the web. On native iOS we ignore
// them entirely and use RevenueCat's App Store Connect products instead.
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
  const { tier, hasAccess, source, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const paywall = useNativePaywall();

  // `paywall.enabled` is true only on native iOS/Android. On web, every buy
  // button continues to go through Stripe Checkout as before.
  const useNative = paywall.enabled;

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Welcome aboard 🎉");
      refreshSubscription();
    }
  }, [searchParams, refreshSubscription]);

  // --- Stripe (web) handlers ----------------------------------------------
  const handleStripeCheckout = async (priceId: string) => {
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start checkout";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleStripePortal = async () => {
    setLoading("portal");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to open portal";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  // --- RevenueCat (native) handlers ---------------------------------------
  const handleNativePurchase = async (info: NativePackageInfo) => {
    if (!user) {
      toast("Please sign in first");
      navigate("/auth");
      return;
    }
    const id = info.pkg.identifier;
    setLoading(id);
    try {
      const result = await paywall.purchase(info.pkg);
      if (result.ok) {
        toast.success("Subscription activated! Welcome aboard 🎉");
        await refreshSubscription();
      } else if (result.cancelled) {
        // User dismissed the sheet — stay quiet.
      } else {
        toast.error(result.error ?? "Purchase failed");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleNativeRestore = async () => {
    setLoading("restore");
    try {
      const result = await paywall.restore();
      if (result.ok) {
        if (result.summary?.isActive) {
          toast.success("Purchases restored 🎉");
        } else {
          toast("No previous purchases found on this Apple ID.");
        }
        await refreshSubscription();
      } else {
        toast.error(result.error ?? "Restore failed");
      }
    } finally {
      setLoading(null);
    }
  };

  // --- Plan data ---------------------------------------------------------
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
        "Priority support",
        "Early access to new features",
        "Hyper-personalized recommendations",
      ],
    },
  ];

  /**
   * Resolve the price label + buy handler for a given plan card.
   * - On native: uses RC package info + triggers the App Store sheet.
   * - On web: uses the hard-coded Stripe price IDs.
   */
  const getPurchaseContext = (planTier: "pro" | "elite") => {
    const planLabel = planTier === "pro" ? "Pro" : "Elite";
    const cycleLabel = billingCycle === "monthly"
      ? "Monthly subscription · 1 month · Auto-renewing"
      : "Annual subscription · 12 months · Auto-renewing";

    if (useNative) {
      const key = `${planTier}_${billingCycle}` as keyof typeof paywall.packages;
      const info = paywall.packages[key];
      // Per Apple guideline 3.1.2: yearly plans must show a per-month
      // equivalent so users can compare. RC sometimes exposes
      // `pricePerMonth(String)`; otherwise we compute from `price`.
      let perMonth: string | null = null;
      if (billingCycle === "yearly" && info) {
        const pkgAny = info.pkg.product as any;
        if (pkgAny?.pricePerMonthString) perMonth = pkgAny.pricePerMonthString;
        else if (typeof pkgAny?.price === "number" && pkgAny?.currencyCode) {
          try {
            perMonth = new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: pkgAny.currencyCode,
            }).format(pkgAny.price / 12);
          } catch { /* ignore */ }
        }
      }
      return {
        title: `${planLabel} — ${cycleLabel}`,
        perMonth,
        label: info?.priceLabel ?? (paywall.loading ? "Loading…" : "Unavailable"),
        disabled: !info,
        loadingKey: info ? info.pkg.identifier : null,
        onBuy: info ? () => handleNativePurchase(info) : null,
      };
    }
    const priceInfo = TIERS[planTier][billingCycle];
    return {
      title: `${planLabel} — ${cycleLabel}`,
      perMonth: null as string | null,
      label: priceInfo.amount,
      disabled: false,
      loadingKey: priceInfo.priceId,
      onBuy: () => handleStripeCheckout(priceInfo.priceId),
    };
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">Choose Your Plan</h1>
      </div>

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl px-4 pt-5 space-y-4">
        {searchParams.get("debug") === "1" && (
          <div className="rounded-xl border border-border/40 bg-card/60 p-3 text-[11px] font-mono space-y-1">
            <div className="font-bold text-foreground">RC DEBUG</div>
            <div>enabled: {String(paywall.enabled)}</div>
            <div>loading: {String(paywall.loading)}</div>
            <div>error: {paywall.error ?? "(none)"}</div>
            <div>offering: {paywall.offering?.identifier ?? "(none)"}</div>
            <div>packageCount: {paywall.offering?.availablePackages?.length ?? 0}</div>
            {(paywall.offering?.availablePackages ?? []).map((p) => (
              <div key={p.identifier} className="text-muted-foreground break-all">
                · {p.identifier} | {p.product?.identifier} | {p.product?.priceString || "(no price)"}
              </div>
            ))}
          </div>
        )}
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
          const isIncluded = !isCurrent && !isUpgrade;
          const purchase = plan.tier !== "free" ? getPurchaseContext(plan.tier as "pro" | "elite") : null;

          return (
            <div
              key={plan.tier}
              className={`ios-card p-5 relative overflow-hidden transition-all ${
                plan.highlight && isUpgrade ? "ring-2 ring-primary/40" : ""
              } ${isCurrent ? "ring-2 ring-primary" : ""} ${
                isIncluded ? "opacity-75" : ""
              }`}
            >
              {isCurrent && (
                <div className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Your Plan
                </div>
              )}
              {isIncluded && (
                <div className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Included
                </div>
              )}
              {plan.highlight && isUpgrade && (
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
                  {purchase ? (
                    <p className="text-sm font-semibold text-primary">{purchase.label}</p>
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
                  <p className="text-xs text-muted-foreground text-center">
                    Included in your plan
                  </p>
                )
              ) : isCurrent ? (
                // "Manage" button. On native iOS subscriptions are managed
                // via Apple's Settings app, not our Stripe portal. We deep
                // link to the subscription management page there.
                source === "revenuecat" ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      window.open("https://apps.apple.com/account/subscriptions", "_blank");
                    }}
                  >
                    <ExternalLink size={14} />
                    Manage in App Store
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleStripePortal}
                    disabled={loading === "portal"}
                  >
                    {loading === "portal" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    Manage Subscription
                  </Button>
                )
              ) : isUpgrade && purchase ? (
                <Button
                  className="w-full"
                  onClick={() => purchase.onBuy?.()}
                  disabled={purchase.disabled || loading === purchase.loadingKey}
                >
                  {loading === purchase.loadingKey ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              ) : isIncluded ? (
                <p className="text-xs text-muted-foreground text-center">
                  Included in your current plan
                </p>
              ) : null}
            </div>
          );
        })}

        {/* Coaching add-on
         * Coaching is a one-time purchase, not a subscription, so it stays
         * on Stripe even on iOS (Apple IAP is required for digital
         * subscriptions and recurring in-app content, but one-off coaching
         * calls delivered outside the app are considered physical-world
         * services and can use external payment). If we later change this
         * to be an in-app consumable we'll need to move it to RC too. */}
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
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleStripeCheckout(TIERS.coaching.priceId)}
            disabled={loading === TIERS.coaching.priceId}
          >
            {loading === TIERS.coaching.priceId ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              `Book a Call — ${TIERS.coaching.amount}`
            )}
          </Button>
        </div>

        {/* Restore Purchases — required by Apple when IAP is enabled. Only
         * surfaced on native; on web there's nothing to restore. */}
        {useNative && (
          <div className="pt-2">
            <Button
              variant="ghost"
              className="w-full gap-2 text-xs text-muted-foreground"
              onClick={handleNativeRestore}
              disabled={loading === "restore"}
            >
              {loading === "restore" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Restore Purchases
            </Button>
            <p className="text-[10px] text-muted-foreground/70 text-center mt-2 leading-relaxed px-4">
              Subscriptions auto-renew unless cancelled at least 24 hours before the period ends.
              Manage or cancel anytime in your Apple ID settings.
            </p>
            <div className="flex items-center justify-center gap-3 mt-2 text-[11px]">
              <button
                onClick={() => navigate("/privacy")}
                className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Privacy Policy
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                onClick={() => navigate("/terms")}
                className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Terms of Use
              </button>
            </div>
          </div>
        )}
        {!useNative && (
          <div className="flex items-center justify-center gap-3 pt-2 text-[11px]">
            <button
              onClick={() => navigate("/privacy")}
              className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Privacy Policy
            </button>
            <span className="text-muted-foreground/50">·</span>
            <button
              onClick={() => navigate("/terms")}
              className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Terms of Use
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pricing;
