// Always-mounted shell host for the push consent fallback.
// Lives at the App level so the shared grace timer in
// usePushConsentFallback runs continuously regardless of route.
//
// All eligibility/timing guards live in the hook itself
// (native Android only, shell-level grace delay, signed-in vs anonymous
// branches, once-per-session sessionStorage flag).
//
// A module-scoped `mounted` flag guards against an accidental second
// mount of the host (e.g. from HMR) so we never run two parallel timers.
import NotificationConsentSheet from "@/components/NotificationConsentSheet";
import { usePushConsentFallback } from "@/hooks/usePushConsentFallback";
import { useEffect, useRef } from "react";

let hostMounted = false;

const PushConsentFallbackHost = () => {
  const isPrimary = useRef(false);
  if (!hostMounted && !isPrimary.current) {
    isPrimary.current = true;
    hostMounted = true;
  }

  useEffect(() => {
    return () => {
      if (isPrimary.current) {
        hostMounted = false;
      }
    };
  }, []);

  if (!isPrimary.current) {
    console.info("[Push] fallback host duplicate mount ignored");
    return null;
  }

  return <PushConsentFallbackHostInner />;
};

const PushConsentFallbackHostInner = () => {
  const { open, onClose } = usePushConsentFallback("shell");
  return <NotificationConsentSheet open={open} onClose={onClose} />;
};

export default PushConsentFallbackHost;
