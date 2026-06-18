import { ArrowLeft, Check, Crown, Zap, Star, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSubscription, type SubscriptionTier } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNativePaywall, type NativePackageInfo } from "@/hooks/useNativePaywall";
import { recordCoachingPurchase, startCoachingStripeCheckout } from "@/lib/coachingPurchase";
import { useCoachingRegion } from "@/hooks/useCoachingRegion";
import { CoachingRegionToggle } from "@/components/CoachingRegionToggle";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { CAL_IOS_NO_PAYMENT_URL } from "@/lib/coachingUrls";
import { logAfEvent, AF_EVENTS, buildPurchaseParams } from "@/lib/appsflyer";
import { Capacitor } from "@capacitor/core";


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
  // Coaching is a one-off purchase. On web/Android it is NOT checked out via
  // `create-checkout`/a price ID here — it routes through the shared
  // `startCoachingStripeCheckout()` helper (create-coaching-checkout) so every
  // entry point uses the same live coaching price. Only the display amount
  // lives here.
  coaching: { amount: "$99.99" },
};

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tier, hasAccess, source, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const paywall = useNativePaywall();
  const region = useCoachingRegion();

  // `paywall.enabled` is true on native iOS AND Android — used for SUBSCRIPTIONS
  // (RevenueCat → App Store / Google Play Billing). Coaching is a separate
  // product: iOS must use StoreKit (Apple 3.1.1), but Android and web both
  // continue to use Stripe checkout for the 1-on-1 coaching call.
  const useNative = paywall.enabled;
  const useIosIapForCoaching =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Welcome aboard 🎉");
      refreshSubscription();
    }
  }, [searchParams, refreshSubscription]);

  // Paywall view event — once per Pricing page mount.
  useEffect(() => {
    logAfEvent(AF_EVENTS.paywallViewed, { source_screen: "pricing" });
  }, []);


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
        await openExternalUrl(data.url, { logTag: "pricing:stripe-checkout" });
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
        await openExternalUrl(data.url, { logTag: "pricing:stripe-portal" });
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
      logAfEvent(AF_EVENTS.initiatedCheckout, {
        plan_id: info.pkg.identifier,
        product_id: info.pkg.product?.identifier ?? info.pkg.identifier,
        product_type: "subscription",
        price: info.pkg.product?.price ?? null,
        currency: info.pkg.product?.currencyCode ?? null,
        store: "appstore",
        source_screen: "pricing",
      });
      const result = await paywall.purchase(info.pkg);
      if (result.ok) {
        toast.success("Subscription activated! Welcome aboard 🎉");
        logAfEvent(AF_EVENTS.purchase, buildPurchaseParams({
          productId: info.pkg.product?.identifier ?? info.pkg.identifier,
          productType: "subscription",
          price: info.pkg.product?.price ?? null,
          currency: info.pkg.product?.currencyCode ?? null,
          store: "appstore",
          orderId: result.transactionId ?? null,
          sourceScreen: "pricing",
        }));
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

  /**
   * Native (iOS) coaching call purchase — StoreKit consumable via RevenueCat.
   * Apple Guideline 3.1.1 requires digital services sold in-app to use IAP,
   * so on native we MUST take this path instead of Stripe checkout.
   *
   * After a successful purchase we record it server-side (idempotent) and
   * open the Cal.com scheduler. No "restore" — consumables are one-shot.
   */
  const handleNativeCoachingPurchase = async (info: NativePackageInfo) => {
    if (!user) {
      toast("Please sign in first");
      navigate(`/auth?returnTo=${encodeURIComponent("/pricing")}`);
      return;
    }
    const id = info.pkg.identifier;
    setLoading(id);
    try {
      logAfEvent(AF_EVENTS.initiatedCheckout, {
        product_id: info.pkg.product?.identifier ?? "coaching_call",
        product_type: "coaching_call",
        price: info.pkg.product?.price ?? null,
        currency: info.pkg.product?.currencyCode ?? null,
        store: "appstore",
        source_screen: "pricing",
      });
      const result = await paywall.purchase(info.pkg);
      if (result.cancelled) {
        return;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Purchase failed");
        return;
      }
      const productId = result.productId ?? info.pkg.product?.identifier ?? "coaching_call";
      const transactionId = result.transactionId ?? `rc_${user.id}_${Date.now()}`;
      console.log("coaching:booking-link-requested", {
        userId: user.id,
        source: "pricing-page",
        usingRealTxId: Boolean(result.transactionId),
      });
      logAfEvent(AF_EVENTS.coachingPurchaseSuccess, buildPurchaseParams({
        productId,
        productType: "coaching_call",
        price: info.pkg.product?.price ?? null,
        currency: info.pkg.product?.currencyCode ?? null,
        store: "appstore",
        orderId: transactionId,
        sourceScreen: "pricing",
      }));
      const recorded = await recordCoachingPurchase({
        source: "appstore",
        productId,
        transactionId,
        purchaseDateMs: result.purchaseDateMs ?? Date.now(),
      });
      toast.success("Coaching call purchased — choose your time.");
      // iOS MUST open the prefilled no-payment Cal.com event so Apple isn't
      // followed by a Cal.com card form (double-charge).
      const url = recorded.iosBookingUrl ?? recorded.calComUrl ?? CAL_IOS_NO_PAYMENT_URL;
      const res = await openExternalUrl(url, { logTag: "coaching:booking-link" });
      if (res.ok) {
        console.log("coaching:booking-link-opened", { native: res.native, source: "pricing-page" });
      } else {
        console.warn("coaching:booking-link-open-failed", { error: res.error, source: "pricing-page" });
        toast.error("Payment received — we couldn't open the scheduler automatically. Visit " + url + " to book.");
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
  // Coaching bullet uses StoreKit's localized price on native (so US shows
  // $99.99 and CA shows $129.99 from the same binary). Falls back to the
  // Stripe US literal on web.
  const nativeCoachingPrice = paywall.packages.coaching?.priceString;
  const coachingBullet = useIosIapForCoaching
    ? (nativeCoachingPrice
        ? `Coaching calls (${nativeCoachingPrice}/session)`
        : "Coaching calls")
    : `Coaching calls (${region.pricing.display}/session)`;

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
        coachingBullet,
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
        coachingBullet,
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
        debug: info?.debug ?? null,
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
      debug: null,
    };
  };

  // Android RC diagnostics are emitted to adb logcat only (see useNativePaywall).
  // No on-screen debug block — it must never ship in user-facing builds.

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

        {/* Apple-compliant subscription disclosure — shown in the purchase
            flow above the Buy buttons. Required by App Store Review
            Guideline 3.1.2. Native (IAP) build only; web shows Stripe terms
            via Stripe's own checkout page. */}
        {useNative && (
          <div className="ios-card p-4 space-y-2 border border-border/60">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">
              Subscription terms
            </p>
            <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
              <li>Payment is charged to your Apple ID at confirmation of purchase.</li>
              <li>
                Your subscription automatically renews unless auto-renew is
                turned off at least 24 hours before the end of the current
                period.
              </li>
              <li>
                Your account is charged for renewal within 24 hours prior to
                the end of the current period at the selected plan's price.
              </li>
              <li>
                You can manage your subscription and turn off auto-renew in
                your Apple ID Account Settings after purchase.
              </li>
              <li>
                No free trial is offered; any unused portion of a free trial,
                if offered, is forfeited when purchasing a subscription.
              </li>
            </ul>
            <div className="flex items-center gap-3 pt-1 text-[11px]">
              <button
                onClick={() => navigate("/privacy")}
                className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Privacy Policy
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                onClick={() => navigate("/terms")}
                className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                Terms of Use
              </button>
            </div>
          </div>
        )}

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
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-foreground">{plan.name}</h2>
                  {purchase ? (
                    <>
                      <p className="text-sm font-semibold text-primary">
                        {purchase.label}
                        {purchase.perMonth && (
                          <span className="text-[11px] font-normal text-muted-foreground"> · ≈ {purchase.perMonth}/mo</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-tight">
                        {purchase.title}
                      </p>
                    </>
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

        {/* Coaching add-on.
         *
         * iOS (native): StoreKit consumable via RevenueCat — Apple Guideline
         * 3.1.1 requires digital services sold in-app to use IAP.
         * Web: Stripe one-off checkout, unchanged.
         *
         * Modeled as a standalone consumable — never tied to Elite or any
         * subscription entitlement. No "restore" surface: consumables can't
         * be restored by design. */}
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

          {useIosIapForCoaching ? (() => {
            const coachingPkg = paywall.packages.coaching;
            const loadingKey = coachingPkg?.pkg.identifier ?? "coaching_pending";
            const isBusy = loading === loadingKey;
            // While RC is still resolving the offering on iPad sandbox, show
            // a clear (but tappable-after-load) state. If RC has finished
            // loading and the package is still missing, render a retry
            // button — App Review must never see a permanent spinner.
            if (!coachingPkg) {
              const stillLoading = paywall.loading;
              return (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => paywall.refresh()}
                  disabled={stillLoading}
                >
                  {stillLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-2" />
                      Loading coaching…
                    </>
                  ) : (
                    "Tap to retry loading coaching"
                  )}
                </Button>
              );
            }
            return (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleNativeCoachingPurchase(coachingPkg)}
                disabled={isBusy}
              >
                {isBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  `Book a Call — ${coachingPkg.priceLabel}`
                )}
              </Button>
            );
          })() : (
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!user) {
                  toast("Please sign in first");
                  navigate("/auth");
                  return;
                }
                setLoading("coaching");
                try {
                  const res = await startCoachingStripeCheckout({
                    logTag: "pricing:coaching-checkout",
                  });
                  if (!res.ok) {
                    toast.error(res.error ?? "Couldn't open checkout. Please try again.");
                  }
                } finally {
                  setLoading(null);
                }
              }}
              disabled={loading === "coaching"}
            >
              {loading === "coaching" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                `Book a Call — ${TIERS.coaching.amount}`
              )}
            </Button>
          )}
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
