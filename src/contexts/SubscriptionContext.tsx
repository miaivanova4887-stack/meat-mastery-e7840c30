import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  initRevenueCat,
  identifyUser,
  logoutUser,
  getEntitlements,
  isRevenueCatAvailable,
  type RcEntitlementSummary,
} from "@/lib/revenuecat";

export type SubscriptionTier = "free" | "pro" | "elite";

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isActive: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
  /**
   * Where the current entitlement came from. Drives UI copy (e.g. "Manage
   * via Apple" vs "Manage via Stripe"). On native iOS the source is always
   * "revenuecat" when active; on web it's "stripe".
   */
  source: "revenuecat" | "stripe" | "none";
  hasAccess: (requiredTier: SubscriptionTier) => boolean;
  refreshSubscription: () => Promise<void>;
}

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [isActive, setIsActive] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [source, setSource] = useState<"revenuecat" | "stripe" | "none">("none");
  const [loading, setLoading] = useState(true);

  // Initialize RevenueCat once on mount (native platforms only).
  // We pass the user id lazily in a separate effect below so a signed-out
  // launch still configures the SDK as anonymous.
  useEffect(() => {
    if (!isRevenueCatAvailable()) return;
    void initRevenueCat(null);
  }, []);

  // Keep the RC identity in sync with Supabase auth so purchases stick to
  // the account across reinstalls. On sign-out, reset to anonymous.
  useEffect(() => {
    if (!isRevenueCatAvailable()) return;
    (async () => {
      // Make sure configure has resolved first.
      await initRevenueCat(user?.id ?? null);
      if (user?.id) {
        await identifyUser(user.id);
      } else {
        await logoutUser();
      }
    })();
  }, [user?.id]);

  const refreshSubscription = useCallback(async () => {
    if (!user || !session) {
      setTier("free");
      setIsActive(false);
      setSubscriptionEnd(null);
      setSource("none");
      setLoading(false);
      return;
    }

    // On native iOS/Android we trust RevenueCat as the source of truth
    // because Apple requires IAP and Stripe isn't used. We still hit the
    // Stripe check as a fallback (e.g. user originally subscribed on the
    // web and is now using the app) and take whichever gives more access.
    let rcSummary: RcEntitlementSummary | null = null;
    if (isRevenueCatAvailable()) {
      try {
        rcSummary = await getEntitlements();
      } catch (e) {
        console.error("RC entitlements fetch failed", e);
      }
    }

    let stripeTier: SubscriptionTier = "free";
    let stripeActive = false;
    let stripeEnd: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      stripeTier = (data?.tier as SubscriptionTier) || "free";
      stripeActive = Boolean(data?.subscribed);
      stripeEnd = data?.subscription_end ?? null;
    } catch (e) {
      console.error("Failed to check subscription:", e);
    }

    const rcRank = rcSummary ? TIER_RANK[rcSummary.tier] : 0;
    const stripeRank = TIER_RANK[stripeTier];

    if (rcRank >= stripeRank && rcSummary && rcSummary.isActive) {
      setTier(rcSummary.tier);
      setIsActive(true);
      setSubscriptionEnd(rcSummary.expiresAt);
      setSource("revenuecat");
    } else if (stripeActive) {
      setTier(stripeTier);
      setIsActive(true);
      setSubscriptionEnd(stripeEnd);
      setSource("stripe");
    } else {
      setTier("free");
      setIsActive(false);
      setSubscriptionEnd(null);
      setSource("none");
    }

    setLoading(false);
  }, [user, session]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, refreshSubscription]);

  const hasAccess = useCallback(
    (requiredTier: SubscriptionTier) => TIER_RANK[tier] >= TIER_RANK[requiredTier],
    [tier]
  );

  return (
    <SubscriptionContext.Provider
      value={{ tier, isActive, subscriptionEnd, source, loading, hasAccess, refreshSubscription }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
};
