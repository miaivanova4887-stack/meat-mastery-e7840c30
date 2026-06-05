import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Capacitor } from "@capacitor/core";
import {
  requestNativePush,
  savePushConsent,
  getNativePushPermission,
} from "@/lib/pushFcm";
import { subscribeToPush } from "@/lib/pushNotifications";
import { openAppSettings } from "@/lib/openAppSettings";
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
      console.info("[PushDecision] sheet-enable native=", native);
      if (native) {
        let osPerm: string = "unsupported";
        try { osPerm = await getNativePushPermission(); } catch (e) {
          console.warn("[PushDecision] sheet getNativePushPermission threw", e);
        }
        console.info("[PushDecision] sheet os-perm=", osPerm);
        if (osPerm === "granted") {
          try { await savePushConsent("granted", prefs); } catch (e) {
            console.warn("[PushDecision] sheet save granted failed", e);
          }
          granted = true;
        } else {
          try {
            const result = await requestNativePush();
            granted = result === "granted";
          } catch (e) {
            console.error("[PushDecision] sheet requestNativePush threw — swallowed", e);
            granted = false;
          }
        }
      } else {
        try { granted = await subscribeToPush(); } catch (e) {
          console.error("[PushDecision] sheet web subscribeToPush threw — swallowed", e);
          granted = false;
        }
      }
      console.info("[PushDecision] sheet-enable result granted=", granted);
      try { await savePushConsent(granted ? "granted" : "denied", prefs); } catch (e) {
        console.warn("[PushDecision] sheet final savePushConsent failed", e);
      }
      if (granted) {
        toast.success("Notifications enabled");
      } else if (native) {
        // On native, a "denied" result almost always means the OS prompt
        // was suppressed because the user previously tapped "Don't allow".
        // The only way to recover is via system settings — open them.
        toast.info("Notifications are off. Opening system settings…");
        try { await openAppSettings(); } catch (e) {
          console.warn("[PushDecision] openAppSettings failed", e);
        }
      } else {
        toast.info("Notifications declined — you can enable them later in Settings.");
      }
      onComplete?.(granted);
      onClose();
    } catch (e) {
      console.error("[PushDecision] sheet-enable outer threw", e);
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
