/**
 * Native paywall hook: loads RevenueCat offerings and exposes price strings
 * + purchase/restore flows for the Pricing page. On web (or when RC isn't
 * configured), `enabled` is false and the page falls back to Stripe.
 */

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import {
  isRevenueCatAvailable,
  getCurrentOffering,
  findPackage,
  findCoachingPackage,
  purchasePackage,
  restorePurchases,
  type PurchaseResult,
} from "@/lib/revenuecat";

/**
 * Per-package diagnostic snapshot. Temporary — used by the on-screen Android
 * debug block in Pricing to prove which RC/Google Play price field is
 * actually populated in the failing APK.
 */
export interface NativePackageDebug {
  packageId: string;
  productId: string | null;
  packageExists: boolean;
  priceStringExists: boolean;
  defaultOptionExists: boolean;
  fullPricePhaseExists: boolean;
  pricingPhasesExist: boolean;
  subscriptionOptionsExist: boolean;
  resolvedPrice: string;
  /** Which step of the resolver returned a value: "priceString" | "defaultOption.fullPricePhase" | ... */
  resolvedSource: string;
}

export interface NativePackageInfo {
  pkg: PurchasesPackage;
  /** Localized price string from the App Store / Google Play, e.g. "$6.99". */
  priceString: string;
  /** Per-cycle label, e.g. "$6.99/mo". */
  priceLabel: string;
  /** Temporary debug data for Android price-mapping diagnosis. */
  debug: NativePackageDebug;
}

export interface NativePaywallState {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  offering: PurchasesOffering | null;
  packages: {
    pro_monthly?: NativePackageInfo;
    pro_yearly?: NativePackageInfo;
    elite_monthly?: NativePackageInfo;
    elite_yearly?: NativePackageInfo;
    coaching?: NativePackageInfo;
  };
  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
}

// ---------------------------------------------------------------------------
// Price resolver — handles both iOS (priceString) and Google Play (Subscription
// Option pricing phases). Order matters: priceString first preserves iOS.
// ---------------------------------------------------------------------------

interface ResolvedPrice {
  price: string;
  source: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickPhaseFormatted(phases: any[] | null | undefined): string {
  if (!Array.isArray(phases)) return "";
  // Prefer the last non-free phase (= full recurring price).
  for (let i = phases.length - 1; i >= 0; i--) {
    const formatted = phases[i]?.price?.formatted;
    const amount = phases[i]?.price?.amountMicros;
    if (formatted && amount && amount > 0) return formatted as string;
  }
  // Fallback to any phase with a formatted string.
  for (const ph of phases) {
    if (ph?.price?.formatted) return ph.price.formatted as string;
  }
  return "";
}

function resolveLocalizedPrice(pkg: PurchasesPackage | null): ResolvedPrice {
  if (!pkg) return { price: "", source: "no-package" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product = pkg.product as any;
  if (!product) return { price: "", source: "no-product" };

  // 1. iOS / generic.
  if (typeof product.priceString === "string" && product.priceString.trim() !== "") {
    return { price: product.priceString, source: "priceString" };
  }

  // 2. Google Play defaultOption.fullPricePhase.
  const defOpt = product.defaultOption;
  const defFull = defOpt?.fullPricePhase?.price?.formatted;
  if (defFull) return { price: defFull as string, source: "defaultOption.fullPricePhase" };

  // 3. Google Play defaultOption.pricingPhases.
  const defPhases = pickPhaseFormatted(defOpt?.pricingPhases);
  if (defPhases) return { price: defPhases, source: "defaultOption.pricingPhases" };

  // 4 + 5. Google Play subscriptionOptions[*].
  const subOpts = Array.isArray(product.subscriptionOptions) ? product.subscriptionOptions : [];
  for (const opt of subOpts) {
    const full = opt?.fullPricePhase?.price?.formatted;
    if (full) return { price: full as string, source: "subscriptionOptions.fullPricePhase" };
  }
  for (const opt of subOpts) {
    const fromPhases = pickPhaseFormatted(opt?.pricingPhases);
    if (fromPhases) return { price: fromPhases, source: "subscriptionOptions.pricingPhases" };
  }

  return { price: "", source: "unresolved" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDebug(pkg: PurchasesPackage | null, resolved: ResolvedPrice): NativePackageDebug {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product = (pkg?.product as any) ?? null;
  const defOpt = product?.defaultOption ?? null;
  const subOpts = product?.subscriptionOptions ?? null;
  return {
    packageId: pkg?.identifier ?? "(none)",
    productId: product?.identifier ?? null,
    packageExists: Boolean(pkg),
    priceStringExists: Boolean(product?.priceString),
    defaultOptionExists: Boolean(defOpt),
    fullPricePhaseExists: Boolean(defOpt?.fullPricePhase),
    pricingPhasesExist: Array.isArray(defOpt?.pricingPhases) && defOpt.pricingPhases.length > 0,
    subscriptionOptionsExist: Array.isArray(subOpts) && subOpts.length > 0,
    resolvedPrice: resolved.price,
    resolvedSource: resolved.source,
  };
}

function toInfo(pkg: PurchasesPackage | null, cycle: "monthly" | "yearly"): NativePackageInfo | undefined {
  if (!pkg) return undefined;
  const resolved = resolveLocalizedPrice(pkg);
  const suffix = cycle === "monthly" ? "/mo" : "/yr";
  return {
    pkg,
    priceString: resolved.price,
    priceLabel: resolved.price ? `${resolved.price}${suffix}` : suffix,
    debug: buildDebug(pkg, resolved),
  };
}

function toCoachingInfo(pkg: PurchasesPackage | null): NativePackageInfo | undefined {
  if (!pkg) return undefined;
  const resolved = resolveLocalizedPrice(pkg);
  return {
    pkg,
    priceString: resolved.price,
    priceLabel: resolved.price || "",
    debug: buildDebug(pkg, resolved),
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
      const resolved = {
        pro_monthly: toInfo(findPackage(off, "pro", "monthly"), "monthly"),
        pro_yearly: toInfo(findPackage(off, "pro", "yearly"), "yearly"),
        elite_monthly: toInfo(findPackage(off, "elite", "monthly"), "monthly"),
        elite_yearly: toInfo(findPackage(off, "elite", "yearly"), "yearly"),
        coaching: toCoachingInfo(findCoachingPackage(off)),
      };
      console.info(
        "[RC DEBUG] paywall packages " +
          JSON.stringify({
            offeringId: off?.identifier ?? null,
            packageCount: off?.availablePackages?.length ?? 0,
            availableIds: (off?.availablePackages ?? []).map((p) => p.identifier),
            resolved: Object.fromEntries(
              Object.entries(resolved).map(([k, v]) => [
                k,
                v
                  ? { price: v.priceString || null, src: v.debug.resolvedSource }
                  : null,
              ])
            ),
          })
      );

      // Android-only one-line dump per package so adb logcat shows the real
      // shape. If `(package not resolved)`, the RC offering returned by Google
      // Play has no package matching pro_monthly / pro_yearly — fix the
      // RevenueCat dashboard offering ↔ Play Console product mapping.
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        const dumpPkg = (label: string, info: NativePackageInfo | undefined) => {
          if (!info) {
            console.info(`[RC ANDROID RAW ${label}] (package not resolved)`);
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const product = info.pkg.product as any;
          console.info(
            `[RC ANDROID RAW ${label}] ` +
              JSON.stringify({
                packageId: info.pkg.identifier,
                productId: product?.identifier ?? null,
                debug: info.debug,
                nullEmptyMatrix: {
                  priceString: product?.priceString || null,
                  defaultOption: product?.defaultOption ? "<present>" : null,
                  fullPricePhase: product?.defaultOption?.fullPricePhase
                    ? "<present>"
                    : null,
                  pricingPhases:
                    product?.defaultOption?.pricingPhases?.length ?? null,
                  subscriptionOptions: Array.isArray(product?.subscriptionOptions)
                    ? product.subscriptionOptions.length
                    : null,
                },
              })
          );
        };
        dumpPkg("PRO_MONTHLY", resolved.pro_monthly);
        dumpPkg("PRO_YEARLY", resolved.pro_yearly);
        dumpPkg("ELITE_MONTHLY", resolved.elite_monthly);
        dumpPkg("ELITE_YEARLY", resolved.elite_yearly);
      }

      setPackages(resolved);
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
