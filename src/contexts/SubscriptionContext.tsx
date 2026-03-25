import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "free" | "pro" | "elite";

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isActive: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    if (!user || !session) {
      setTier("free");
      setIsActive(false);
      setSubscriptionEnd(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      setTier((data?.tier as SubscriptionTier) || "free");
      setIsActive(data?.subscribed || false);
      setSubscriptionEnd(data?.subscription_end || null);
    } catch (e) {
      console.error("Failed to check subscription:", e);
      setTier("free");
      setIsActive(false);
    } finally {
      setLoading(false);
    }
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
    <SubscriptionContext.Provider value={{ tier, isActive, subscriptionEnd, loading, hasAccess, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
};
