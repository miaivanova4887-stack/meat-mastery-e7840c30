import { ArrowLeft, Crown, Loader2, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useNativePaywall } from "@/hooks/useNativePaywall";
import { recordCoachingPurchase, startCoachingStripeCheckout } from "@/lib/coachingPurchase";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { CAL_IOS_NO_PAYMENT_URL } from "@/lib/coachingUrls";
import { logAfEvent, AF_EVENTS, buildPurchaseParams } from "@/lib/appsflyer";
import { Capacitor } from "@capacitor/core";

/**
 * Coaching purchase routing:
 * - iOS native app  -> StoreKit consumable via RevenueCat (Apple 3.1.1).
 * - Android native  -> Stripe checkout (Google Play does not require IAP for
 *   physical/real-world services like a 1-on-1 coaching call).
 * - Web             -> Stripe checkout.
 */
const useIosIap = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";



const Coaching = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const paywall = useNativePaywall();
  const useNative = useIosIap();

  useEffect(() => {
    logAfEvent(AF_EVENTS.paywallViewed, { source_screen: "coaching" });
  }, []);


  const handleBookPaid = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate(`/auth?returnTo=${encodeURIComponent("/coaching")}`);
      return;
    }
    setLoading(true);
    try {
      if (useNative) {
        // iOS: StoreKit consumable via RevenueCat. Stripe must not be reachable
        // from inside the iOS app (Apple Guideline 3.1.1).
        const pkg = paywall.packages.coaching;
        if (!pkg) {
          // RC offering hasn't resolved (or product missing). Surface and
          // attempt a refresh so App Review never sees an inert button.
          await paywall.refresh();
          toast.error("Coaching isn't available right now. Please try again in a moment.");
          return;
        }
        logAfEvent(AF_EVENTS.initiatedCheckout, {
          product_id: pkg.pkg.product?.identifier ?? "coaching_call",
          product_type: "coaching_call",
          price: pkg.pkg.product?.price ?? null,
          currency: pkg.pkg.product?.currencyCode ?? null,
          store: "appstore",
          source_screen: "coaching",
        });
        const result = await paywall.purchase(pkg.pkg);
        if (result.cancelled) return;
        if (!result.ok) {
          toast.error(result.error ?? "Purchase failed");
          return;
        }
        console.log("coaching:booking-link-requested", {
          userId: session.user.id,
          source: "coaching-page",
          usingRealTxId: Boolean(result.transactionId),
        });
        logAfEvent(AF_EVENTS.coachingPurchaseSuccess, buildPurchaseParams({
          productId: result.productId ?? pkg.pkg.product?.identifier ?? "coaching_call",
          productType: "coaching_call",
          price: pkg.pkg.product?.price ?? null,
          currency: pkg.pkg.product?.currencyCode ?? null,
          store: "appstore",
          orderId: result.transactionId ?? null,
          sourceScreen: "coaching",
        }));
        const recorded = await recordCoachingPurchase({
          source: "appstore",
          productId: result.productId ?? pkg.pkg.product?.identifier ?? "coaching_call",
          transactionId: result.transactionId ?? `rc_${session.user.id}_${Date.now()}`,
          purchaseDateMs: result.purchaseDateMs ?? Date.now(),
        });
        toast.success("Coaching call purchased — choose your time.");
        // iOS MUST open the prefilled no-payment Cal.com event so Apple isn't
        // followed by a Cal.com card form (double-charge).
        const url = recorded.iosBookingUrl ?? recorded.calComUrl ?? CAL_IOS_NO_PAYMENT_URL;
        const res = await openExternalUrl(url, { logTag: "coaching:booking-link" });
        if (res.ok) {
          console.log("coaching:booking-link-opened", { native: res.native, source: "coaching-page" });
        } else {
          console.warn("coaching:booking-link-open-failed", { error: res.error, source: "coaching-page" });
          toast.error("Payment received — we couldn't open the scheduler automatically. Visit " + url + " to book.");
        }
        return;

      }

      // Web/Android: shared production coaching Stripe checkout.
      const res = await startCoachingStripeCheckout({ logTag: "coaching:stripe-checkout" });
      if (!res.ok) throw new Error(res.error ?? "Failed to start checkout");
    } catch (e: any) {
      toast.error(e?.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">Coaching</h1>
      </div>

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl px-4 pt-6 space-y-5">
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

        <div className="ios-card p-5">
          <div className="text-center mb-3">
            <p className="text-2xl font-bold text-foreground">
              {useNative
                ? (paywall.packages.coaching?.priceString || "Loading price…")
                : "$99.99"}
            </p>
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
              <Button className="w-full gap-2 mt-2" onClick={() => {
                navigate(`/auth?returnTo=${encodeURIComponent("/coaching")}`);
              }}>
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
        </div>
      </div>
    </div>
  );
};

export default Coaching;
