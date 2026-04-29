// Always-mounted shell host for the push consent fallback.
// Lives at the App level so it runs on every route — including
// /onboarding, /auth, and unauthenticated routes — guaranteeing the
// push opt-in sheet can surface for native Android users whose
// `profiles.push_consent` is still 'unset', regardless of where they
// land first or whether they ever reach Home/Profile.
//
// The hook itself enforces all guards (native Android only, signed-in
// profile loaded, consent unset, once-per-session via sessionStorage).
import NotificationConsentSheet from "@/components/NotificationConsentSheet";
import { usePushConsentFallback } from "@/hooks/usePushConsentFallback";

const PushConsentFallbackHost = () => {
  const { open, onClose } = usePushConsentFallback("shell");
  return <NotificationConsentSheet open={open} onClose={onClose} />;
};

export default PushConsentFallbackHost;
