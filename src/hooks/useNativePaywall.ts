/**
 * Native paywall hook: loads RevenueCat offerings and exposes price strings
 * + purchase/restore flows for the Pricing page. On web (or when RC isn't
 * configured), `enabled` is false and the page falls back to Stripe.
 */

import { useCallback, useEffect, useState } from "react";
import type { PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import {
  isRevenueCatAvailable,
  getCurrentOffering,
  findPackage,
  purchasePackage,
  restorePurchases,
  type PurchaseResult,
} from "@/lib/revenuecat";

export interface NativePackageInfo {
  pkg: PurchasesPackage;
  /** Localized price string from the App Store, e.g. "$6.99". */
  priceString: string;
  /** Per-cycle label, e.g. "$6.99/mo". */
  priceLabel: string;
}

export interface NativePaywallState {
  /** True on native iOS/Android; means the Pricing page should show IAP flow. */
  enabled: boolean;
  loading: boolean;
  error: string | null;
  offering: PurchasesOffering | null;
  /** Resolved packages keyed by tier+cycle. Any key may be undefined if RC doesn't have it yet. */
  packages: {
    pro_monthly?: NativePackageInfo;
    pro_yearly?: NativePackageInfo;
    elite_monthly?: NativePackageInfo;
    elite_yearly?: NativePackageInfo;
  };
  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
}

function toInfo(pkg: PurchasesPackage | null, cycle: "monthly" | "yearly"): NativePackageInfo | undefined {
  if (!pkg) return undefined;
  const price = pkg.product?.priceString ?? "";
  const suffix = cycle === "monthly" ? "/mo" : "/yr";
  return {
    pkg,
    priceString: price,
    priceLabel: price ? `${price}${suffix}` : suffix,
  };
}

export function useNativePaywall(): NativePaywallState {
  const enabled = isRevenueCatAvailable();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [packages, setPackages] = useState<NativePaywallState["packages"]>({});

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const off = await getCurrentOffering();
      setOffering(off);
      setPackages({
        pro_monthly: toInfo(findPackage(off, "pro", "monthly"), "monthly"),
        pro_yearly: toInfo(findPackage(off, "pro", "yearly"), "yearly"),
        elite_monthly: toInfo(findPackage(off, "elite", "monthly"), "monthly"),
        elite_yearly: toInfo(findPackage(off, "elite", "yearly"), "yearly"),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load products";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    enabled,
    loading,
    error,
    offering,
    packages,
    refresh,
    purchase: purchasePackage,
    restore: restorePurchases,
  };
}
