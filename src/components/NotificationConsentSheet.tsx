import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Capacitor } from "@capacitor/core";
import {
  requestNativePush,
  savePushConsent,
} from "@/lib/pushFcm";
import { subscribeToPush } from "@/lib/pushNotifications";
import { toast } from "sonner";

interface NotificationConsentSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called after the user makes a choice (granted or denied). */
  onComplete?: (granted: boolean) => void;
}

const DEFAULT_PREFS = {
  streaks: true,
  recipes: true,
  fasting: true,
  coaching: true,
  marketing: false,
};

const PREF_LABELS: Record<keyof typeof DEFAULT_PREFS, string> = {
  streaks: "Streak & milestone reminders",
  recipes: "New recipes & meal ideas",
  fasting: "Fasting & ketosis updates",
  coaching: "Coaching tips",
  marketing: "Promotions & special offers",
};

export default function NotificationConsentSheet({
  open,
  onClose,
  onComplete,
}: NotificationConsentSheetProps) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    try {
      let granted = false;
      const native = Capacitor.isNativePlatform();
      console.info("[Push] sheet Enable tapped native=", native);
      if (native) {
        const result = await requestNativePush();
        granted = result === "granted";
      } else {
        granted = await subscribeToPush();
      }
      console.info("[Push] sheet Enable result granted=", granted);
      // Save preferences alongside consent
      await savePushConsent(granted ? "granted" : "denied", prefs);
      if (granted) toast.success("Notifications enabled");
      else toast.info("Notifications declined — you can enable them later in Settings.");
      onComplete?.(granted);
      onClose();
    } catch (e) {
      console.error("[Push] sheet Enable error", e);
      toast.error("Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      await savePushConsent("denied", prefs);
      onComplete?.(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="px-5 pb-8">
        <div className="mx-auto max-w-md w-full pt-2">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Bell size={22} className="text-primary" />
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">
            Stay on track
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Get gentle nudges that keep your streak alive and surface what matters. You choose what.
          </p>

          <div className="space-y-3 mb-6">
            {(Object.keys(prefs) as Array<keyof typeof prefs>).map((k) => (
              <label
                key={k}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-sm text-foreground">{PREF_LABELS[k]}</span>
                <Switch
                  checked={prefs[k]}
                  onCheckedChange={(v) => setPrefs({ ...prefs, [k]: v })}
                />
              </label>
            ))}
          </div>

          <Button
            className="w-full mb-2"
            onClick={handleEnable}
            disabled={busy}
          >
            Enable notifications
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleSkip}
            disabled={busy}
          >
            Not now
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
