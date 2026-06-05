import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Calendar, CheckCircle2, Loader2, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useNativePaywall } from "@/hooks/useNativePaywall";
import { isRevenueCatAvailable } from "@/lib/revenuecat";
import { recordCoachingPurchase } from "@/lib/coachingPurchase";
import { openExternalUrl, copyToClipboard } from "@/lib/openExternalUrl";
import { CAL_IOS_NO_PAYMENT_URL, CAL_PAID_URL } from "@/lib/coachingUrls";

type Screen = "info" | "payment" | "calcom" | "success";

interface CoachingBookingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScreen?: Screen;
}


const CoachingBooking = ({ open, onOpenChange, initialScreen = "info" }: CoachingBookingProps) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const paywall = useNativePaywall();
  const useNative = isRevenueCatAvailable();

  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [schedulerUrl, setSchedulerUrl] = useState<string>(useNative ? CAL_IOS_NO_PAYMENT_URL : CAL_PAID_URL);
  const [showFallback, setShowFallback] = useState(false);


  // Reset screen when opened
  useEffect(() => {
    if (open) setScreen(initialScreen);
  }, [open, initialScreen]);

  // Fetch localized CMS copy. Defensively wrapped so a transient session/network
  // error during post-login refresh cannot crash the dialog (and the page it's
  // mounted on, e.g. Home for Elite users).
  useEffect(() => {
    if (!open) return;

    const locale = i18n.language?.startsWith("fr") ? "fr" : "en";
    let cancelled = false;

    (async () => {
      try {
        const { data: blocks } = await supabase
          .from("content_blocks")
          .select("key, value")
          .eq("page", "coaching")
          .eq("section", "booking")
          .eq("locale", locale);

        if (cancelled) return;
        const map: Record<string, string> = {};
        (blocks ?? []).forEach((b) => {
          if (b?.key) map[b.key] = b.value ?? "";
        });
        setContent(map);
      } catch (e) {
        console.warn("[CoachingBooking] content_blocks fetch failed", e);
        if (!cancelled) setContent({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, i18n.language]);

  const handlePayment = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onOpenChange(false);
      navigate(`/auth?returnTo=${encodeURIComponent("/coaching")}`);
      return;
    }
    setLoading(true);
    try {
      if (useNative) {
        // iOS in-app: StoreKit consumable via RevenueCat. Stripe must not
        // be reached from inside the iOS app (Apple Guideline 3.1.1).
        const pkg = paywall.packages.coaching;
        if (!pkg) {
          await paywall.refresh();
          toast.error("Coaching isn't available right now. Please try again in a moment.");
          setScreen("info");
          return;
        }
        const result = await paywall.purchase(pkg.pkg);
        if (result.cancelled) {
          setScreen("info");
          return;
        }
        if (!result.ok) {
          toast.error(result.error ?? "Purchase failed");
          setScreen("info");
          return;
        }
        console.log("coaching:booking-link-requested", { userId: session.user.id });
        const recorded = await recordCoachingPurchase({
          source: "appstore",
          productId: pkg.pkg.product?.identifier ?? "coaching_call",
          transactionId: `rc_${session.user.id}_${Date.now()}`,
          purchaseDateMs: Date.now(),
        });
        toast.success("Coaching call purchased — choose your time.");
        // iOS MUST open the no-payment Cal.com event — never the paid one
        // (otherwise Cal.com asks for a card on top of the Apple charge).
        const url = recorded.iosBookingUrl ?? recorded.calComUrl ?? CAL_IOS_NO_PAYMENT_URL;
        setSchedulerUrl(url);
        setShowFallback(false);
        // Best-effort auto-open. If the native browser can't open, the
        // calcom screen's CTA + fallback UI lets the user copy/open manually.
        const res = await openExternalUrl(url, { logTag: "coaching:booking-link" });
        if (res.ok) {
          console.log("coaching:booking-link-opened", { native: res.native });
        } else {
          console.warn("coaching:booking-link-open-failed", { error: res.error });
          setShowFallback(true);
        }
        setScreen("calcom");
        return;
      }


      // Web: existing Stripe one-off flow.
      const { data, error } = await supabase.functions.invoke("create-coaching-checkout");
      if (error) throw error;
      if (data?.url) {
        await openExternalUrl(data.url, { logTag: "coaching:stripe-checkout" });
      }
    } catch (e) {
      console.error("Coaching checkout error:", e);
      toast.error("Couldn't open checkout. Please try again.");
      setScreen("info");
    } finally {
      setLoading(false);
    }
  }, [navigate, onOpenChange, location, useNative, paywall]);

  const handleDone = useCallback(async () => {
    if (!user?.id) {
      setScreen("success");
      return;
    }
    try {
      await supabase.from("coaching_sessions").insert({
        user_id: user.id,
        session_type: "paid",
        session_month: new Date().toISOString().slice(0, 7),
      });
    } catch (e) {
      console.warn("[CoachingBooking] session log failed", e);
    }
    setScreen("success");
  }, [user]);

  const close = () => onOpenChange(false);

  const handleOpenScheduler = useCallback(async () => {
    console.log("coaching:open-scheduler-tap", { url: schedulerUrl });
    if (!schedulerUrl) {
      toast.error("Booking link unavailable — please contact support.");
      setShowFallback(true);
      return;
    }
    const res = await openExternalUrl(schedulerUrl, { logTag: "coaching:open-scheduler" });
    if (!res.ok) {
      setShowFallback(true);
      toast.error("Payment received — we couldn't open the scheduler automatically.");
    }
  }, [schedulerUrl]);

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(schedulerUrl);
    if (ok) toast.success("Booking link copied");
    else toast.error("Couldn't copy — please long-press the link to copy.");
  }, [schedulerUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-card border-border/50 rounded-2xl overflow-hidden [&>button]:hidden">
        <button onClick={close} className="absolute top-3 right-3 z-10 text-muted-foreground hover:text-foreground p-1">
          <X size={18} />
        </button>

        <div className="p-6 pt-8">
          {/* Screen A: Info */}
          {screen === "info" && (
            <div className="space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                <Calendar size={26} className="text-primary-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold text-foreground">{content.title || "Book a Coaching Call"}</h2>
                <p className="text-sm text-muted-foreground">{content.description || ""}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {content.paid_label || "CA$99 per session"}
                </p>
              </div>
              <Button onClick={() => { handlePayment(); setScreen("payment"); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 font-semibold">
                {content.pay_button || "Proceed to Payment"}
              </Button>
              <Button variant="ghost" onClick={close} className="w-full text-muted-foreground">
                Cancel
              </Button>
            </div>
          )}

          {/* Screen B: Payment */}
          {screen === "payment" && (
            <div className="space-y-5 animate-fade-in text-center py-8">
              <Loader2 size={40} className="animate-spin text-primary mx-auto" />
              <p className="text-sm text-foreground font-medium">Opening secure payment...</p>
              <p className="text-xs text-muted-foreground">Complete your payment in the browser tab, then return here.</p>
              <Button variant="outline" onClick={() => setScreen("info")} className="mt-4">
                Cancel
              </Button>
            </div>
          )}

          {/* Screen C: Cal.com */}
          {screen === "calcom" && (
            <div className="space-y-5 animate-fade-in text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {content.payment_confirmed || "Payment confirmed! Choose your time slot."}
              </h2>
              <p className="text-xs text-muted-foreground">Your payment is confirmed. Complete your booking in the browser.</p>
              <Button
                onClick={handleOpenScheduler}
                variant="outline"
                className="w-full rounded-xl"
                disabled={!schedulerUrl}
              >
                Open Cal.com Scheduler
              </Button>
              {showFallback && (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3 space-y-2 text-left">
                  <p className="text-xs text-muted-foreground">
                    If the scheduler didn't open, copy this link and paste it into Safari:
                  </p>
                  <p className="text-xs font-mono break-all text-foreground select-all">
                    {schedulerUrl}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={handleCopyLink}
                    className="w-full gap-2 rounded-xl"
                  >
                    <Copy size={14} />
                    Copy booking link
                  </Button>
                </div>
              )}
              <Button onClick={handleDone} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 font-semibold">
                Done
              </Button>
            </div>
          )}

          {/* Screen D: Success */}
          {screen === "success" && (
            <div className="space-y-5 animate-fade-in text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{content.success_title || "Your coaching call is booked!"}</h2>
              <p className="text-sm text-muted-foreground">You'll receive a confirmation email with all the details.</p>
              <Button onClick={close} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 font-semibold">
                Back to Home
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoachingBooking;
