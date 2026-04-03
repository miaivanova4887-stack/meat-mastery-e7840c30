import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";

type Screen = "info" | "payment" | "calcom" | "success";

interface CoachingBookingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScreen?: Screen;
}

const CAL_URL = "https://cal.com/carnivorex/coaching-session";

const CoachingBooking = ({ open, onOpenChange, initialScreen = "info" }: CoachingBookingProps) => {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [content, setContent] = useState<Record<string, string>>({});
  const [usedFreeSession, setUsedFreeSession] = useState(false);
  const [loading, setLoading] = useState(false);

  const isElite = tier === "elite";
  const isFreeEligible = isElite && !usedFreeSession;

  // Reset screen when opened
  useEffect(() => {
    if (open) setScreen(initialScreen);
  }, [open, initialScreen]);

  // Fetch content + check session usage
  useEffect(() => {
    if (!open || !user) return;

    const locale = i18n.language?.startsWith("fr") ? "fr" : "en";

    const fetchData = async () => {
      const [{ data: blocks }, { data: sessions }] = await Promise.all([
        supabase
          .from("content_blocks")
          .select("key, value")
          .eq("page", "coaching")
          .eq("section", "booking")
          .eq("locale", locale),
        supabase
          .from("coaching_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("session_type", "included")
          .eq("session_month", new Date().toISOString().slice(0, 7))
          .limit(1),
      ]);

      if (blocks) {
        const map: Record<string, string> = {};
        blocks.forEach((b) => (map[b.key] = b.value));
        setContent(map);
      }
      setUsedFreeSession((sessions?.length ?? 0) > 0);
    };

    fetchData();
  }, [open, user, i18n.language]);

  const handlePayment = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onOpenChange(false);
      navigate("/auth", { state: { from: location } });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-coaching-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error("Coaching checkout error:", e);
    } finally {
      setLoading(false);
    }
  }, [navigate, onOpenChange]);

  const handleFreeBook = useCallback(() => {
    window.open(CAL_URL, "_blank");
    setScreen("calcom");
  }, []);

  const handleDone = useCallback(async () => {
    if (!user) return;
    await supabase.from("coaching_sessions").insert({
      user_id: user.id,
      session_type: isFreeEligible ? "included" : "paid",
      session_month: new Date().toISOString().slice(0, 7),
    });
    setScreen("success");
  }, [user, isFreeEligible]);

  const close = () => onOpenChange(false);

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
                  {isFreeEligible
                    ? content.included_label || "Included in your Elite plan this month"
                    : content.paid_label || "CA$99 per session"}
                </p>
              </div>
              {isFreeEligible ? (
                <Button onClick={handleFreeBook} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 font-semibold">
                  {content.book_free_button || "Book Free Session"}
                </Button>
              ) : (
                <Button onClick={() => { handlePayment(); setScreen("payment"); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 font-semibold">
                  {content.pay_button || "Proceed to Payment"}
                </Button>
              )}
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
                onClick={() => window.open(CAL_URL, "_blank")}
                variant="outline"
                className="w-full rounded-xl"
              >
                Open Cal.com Scheduler
              </Button>
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
