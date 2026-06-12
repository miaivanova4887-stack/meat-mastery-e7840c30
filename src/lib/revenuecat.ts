/**
 * RevenueCat integration for Carnivore Coach Pro.
 *
 * Platform strategy:
 * - Native iOS (Capacitor): REAL in-app purchases via RevenueCat / StoreKit.
 *   Apple requires IAP for digital subscriptions sold inside the app, so we
 *   CANNOT use Stripe checkout from the iOS native shell.
 * - Web (vite dev / hosted build): continues to use Stripe Checkout via the
 *   existing Supabase edge functions. RC is a no-op here.
 * - Native Android: not wired yet. If/when we ship to Play, we add a Google
 *   SDK key below and the same flow works.
 *
 * All public functions are safe to call on any platform — they silently
 * no-op when RC isn't available so calling code can stay platform-agnostic.
 */

import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * RevenueCat public SDK keys. These are safe to ship in the bundle — they're
 * designed for client distribution (unlike the App Store Connect private
 * in-app purchase key, which stays on RevenueCat's servers only).
 *
 * TODO(mia): Paste the real iOS key from RevenueCat dashboard →
 *   Project Settings → API Keys → "Public app-specific API key" for iOS.
 *   It starts with `appl_`.
 */
const REVENUECAT_IOS_KEY = "appl_gynfZqPKaFVIhSVZFDUUghawXno";
const REVENUECAT_ANDROID_KEY = "goog_LJgdLQzxkXUPLaORSMbZNpIPLMW";

/**
 * The RevenueCat "entitlement" identifiers configured in the RC dashboard.
 * An entitlement is the abstract permission (e.g. "pro") that one or more
 * products grant. We grant these in the RC dashboard → Entitlements.
 *
 * IMPORTANT: these strings must match exactly what's configured in RC.
 */
export const ENTITLEMENT_PRO = "pro";
export const ENTITLEMENT_ELITE = "elite";

/**
 * Coaching call — sold as a StoreKit **consumable** IAP. It is intentionally
 * NOT tied to any RevenueCat entitlement (and definitely not Elite): every
 * purchase grants exactly one 1-hour coaching session, recorded server-side
 * via the `record-coaching-purchase` edge function. We also do NOT surface
 * "restore" for this product — consumables are one-shot by Apple's design.
 *
 * IMPORTANT: these strings MUST match the App Store Connect product ID and
 * the RevenueCat package identifier exactly, otherwise iPad sandbox / App
 * Review will see a stuck "Loading…" state for the Book a Call button.
 */
export const COACHING_PRODUCT_ID = "com.mi4labs.carnivorex.coaching_call";
export const COACHING_PACKAGE_ID = "coaching_call";

/**
 * RevenueCat "offering" identifier. RC lets you define multiple offerings
 * (e.g. "default", "holiday_promo") but we only use the default one.
 * Leave as `null` to use whatever offering is marked Current in the dashboard.
 */
export const DEFAULT_OFFERING: string | null = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

let configured = false;
let configurePromise: Promise<void> | null = null;

/** Whether RevenueCat can run on this platform. Native iOS/Android only. */
export function isRevenueCatAvailable(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
}

/**
 * Initialize RevenueCat. Safe to call multiple times — the first call wins
 * and subsequent calls return the same promise. No-op on web.
 *
 * @param appUserId Optional stable user id (e.g. Supabase user.id) so RC
 *   can tie purchases to the same account across reinstalls. If omitted, RC
 *   uses an anonymous id stored on the device.
 */
export async function initRevenueCat(appUserId?: string | null): Promise<void> {
  if (!isRevenueCatAvailable()) return;
  if (configured) return;
  if (configurePromise) return configurePromise;

  const platform = Capacitor.getPlatform();
  const apiKey = platform === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (apiKey.includes("REPLACE_ME")) {
    // Don't silently crash — surface it in the console so we notice during
    // the first sandbox test. Purchases will fail until this is filled in.
    console.warn(
      "[revenuecat] API key not configured yet. Set REVENUECAT_IOS_KEY in src/lib/revenuecat.ts."
    );
    return;
  }

  configurePromise = (async () => {
    try {
      const level = platform === "android" ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
      await Purchases.setLogLevel({ level });
      await Purchases.configure({
        apiKey,
        appUserID: appUserId ?? undefined,
      });
      configured = true;
      console.info("[revenuecat] configured", {
        platform,
        keyPrefix: apiKey.slice(0, 8),
        appUserId: appUserId ?? "(anonymous)",
      });
    } catch (e) {
      console.error("[revenuecat] configure failed", e);
      // Reset so a later call can retry (e.g. after user signs in).
      configurePromise = null;
    }
  })();

  return configurePromise;
}

/**
 * Attach / re-attach an app user id to the RC identity. Call when the user
 * signs in so their purchases follow the account across devices.
 */
export async function identifyUser(appUserId: string): Promise<void> {
  if (!isRevenueCatAvailable() || !configured) return;
  try {
    await Purchases.logIn({ appUserID: appUserId });
  } catch (e) {
    console.error("[revenuecat] logIn failed", e);
  }
}

/**
 * Reset to anonymous when the user signs out. Prevents the next signed-out
 * user on this device from inheriting the previous user's entitlements.
 */
export async function logoutUser(): Promise<void> {
  if (!isRevenueCatAvailable() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    // RC throws if already anonymous — that's fine, ignore.
    console.debug("[revenuecat] logOut noop", e);
  }
}

// ---------------------------------------------------------------------------
// Entitlements / customer info
// ---------------------------------------------------------------------------

export interface RcEntitlementSummary {
  /** "pro" | "elite" | "free" — the highest tier the user currently holds. */
  tier: "free" | "pro" | "elite";
  isActive: boolean;
  /** ISO timestamp of when access ends (for renewing subs = next renewal). */
  expiresAt: string | null;
  /** Raw CustomerInfo for any caller that needs more detail. */
  raw: CustomerInfo | null;
}

function summarize(info: CustomerInfo | null): RcEntitlementSummary {
  if (!info) return { tier: "free", isActive: false, expiresAt: null, raw: null };

  const active = info.entitlements?.active ?? {};
  const elite = active[ENTITLEMENT_ELITE];
  const pro = active[ENTITLEMENT_PRO];

  if (elite) {
    return {
      tier: "elite",
      isActive: true,
      expiresAt: elite.expirationDate ?? null,
      raw: info,
    };
  }
  if (pro) {
    return {
      tier: "pro",
      isActive: true,
      expiresAt: pro.expirationDate ?? null,
      raw: info,
    };
  }
  return { tier: "free", isActive: false, expiresAt: null, raw: info };
}

export async function getEntitlements(): Promise<RcEntitlementSummary> {
  if (!isRevenueCatAvailable() || !configured) {
    return { tier: "free", isActive: false, expiresAt: null, raw: null };
  }
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return summarize(customerInfo);
  } catch (e) {
    console.error("[revenuecat] getCustomerInfo failed", e);
    return { tier: "free", isActive: false, expiresAt: null, raw: null };
  }
}

// ---------------------------------------------------------------------------
// Offerings (products to show in the paywall)
// ---------------------------------------------------------------------------

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isRevenueCatAvailable() || !configured) return null;
  try {
    const { current, all } = await Purchases.getOfferings();
    const chosen = DEFAULT_OFFERING && all?.[DEFAULT_OFFERING] ? all[DEFAULT_OFFERING] : current ?? null;
    console.info("[RC DEBUG] offerings", {
      currentId: current?.identifier ?? null,
      allIds: Object.keys(all ?? {}),
      chosenId: chosen?.identifier ?? null,
      packageCount: chosen?.availablePackages?.length ?? 0,
      packages: (chosen?.availablePackages ?? []).map((p) => ({
        identifier: p.identifier,
        productId: p.product?.identifier,
        priceString: p.product?.priceString,
        period: (p.product as { subscriptionPeriod?: string })?.subscriptionPeriod,
      })),
    });
    return chosen;
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    // Stringify on a single line so adb logcat shows the actual RC error code
    // instead of `[object Object]`. The RC Android SDK throws here when
    // Google Play Billing can't surface products (sideloaded build, products
    // not ACTIVE in Play Console, wrong package name, or RC↔Play mapping off).
    console.error(
      "[RC DEBUG] getOfferings failed " +
        JSON.stringify({
          message: err?.message ?? null,
          code: err?.code ?? null,
          underlying: err?.underlyingErrorMessage ?? null,
          name: err?.name ?? null,
        })
    );
    return null;
  }
}

/**
 * Find a package within an offering by our own semantic key. We expect the RC
 * dashboard to define packages with these identifiers (or the built-in
 * "$rc_monthly" / "$rc_annual" types). The loose matching below lets us
 * tolerate either naming convention without a code change.
 */
export function findPackage(
  offering: PurchasesOffering | null,
  tier: "pro" | "elite",
  cycle: "monthly" | "yearly"
): PurchasesPackage | null {
  if (!offering) return null;

  // Preferred: explicit identifier like "pro_monthly", "elite_yearly".
  const explicitKey = `${tier}_${cycle}`;
  const explicit = offering.availablePackages.find(
    (p) => p.identifier.toLowerCase() === explicitKey
  );
  if (explicit) return explicit;

  // Fallback: RC built-in package types. Only useful if the offering has a
  // single tier mixed in, which we *don't* do — we have pro + elite side by
  // side — so this will rarely fire, but keep it as a safety net.
  if (tier === "pro") {
    if (cycle === "monthly" && offering.monthly) return offering.monthly;
    if (cycle === "yearly" && offering.annual) return offering.annual;
  }

  // Last resort: substring match on both tier + cycle keywords.
  return (
    offering.availablePackages.find((p) => {
      const id = p.identifier.toLowerCase();
      return id.includes(tier) && id.includes(cycle === "yearly" ? "year" : "month");
    }) ?? null
  );
}

/**
 * Locate the coaching consumable package in an offering. We match by package
 * identifier first (`coaching_call`), then by underlying StoreKit product id
 * (`com.mi4labs.carnivorex.coaching_call`) as a safety net so a dashboard
 * typo doesn't make the button inert during App Review.
 */
export function findCoachingPackage(
  offering: PurchasesOffering | null
): PurchasesPackage | null {
  if (!offering) return null;
  const byId = offering.availablePackages.find(
    (p) => p.identifier.toLowerCase() === COACHING_PACKAGE_ID
  );
  if (byId) return byId;
  return (
    offering.availablePackages.find(
      (p) => p.product?.identifier === COACHING_PRODUCT_ID
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Purchase / restore
// ---------------------------------------------------------------------------

export interface PurchaseResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  summary?: RcEntitlementSummary;
  /**
   * Real store transaction id from RC's MakePurchaseResult.transaction.
   * On iOS this is the StoreKit transactionIdentifier; on Android the order
   * id. Use this — not a synthesized id — to make `record-coaching-purchase`
   * truly idempotent and to allow future webhook reconciliation.
   * Undefined only if the installed RC SDK didn't surface a transaction
   * object (older runtimes / unexpected shape).
   */
  transactionId?: string;
  /** Real product id from the store (matches App Store Connect product). */
  productId?: string;
  /** Real purchase timestamp from the store, in ms since epoch. */
  purchaseDateMs?: number;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!isRevenueCatAvailable() || !configured) {
    return { ok: false, error: "In-app purchases are only available in the mobile app." };
  }
  try {
    const result = await Purchases.purchasePackage({ aPackage: pkg });
    // Defensively read the transaction fields at runtime — older RC builds
    // may omit `transaction` even when current types declare it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = (result as any)?.transaction as
      | { transactionIdentifier?: string; productIdentifier?: string; purchaseDate?: string }
      | undefined;
    const txId = tx?.transactionIdentifier;
    const productId =
      tx?.productIdentifier ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((result as any)?.productIdentifier as string | undefined) ??
      pkg.product?.identifier;
    let purchaseDateMs: number | undefined;
    if (tx?.purchaseDate) {
      const t = Date.parse(tx.purchaseDate);
      if (!Number.isNaN(t)) purchaseDateMs = t;
    }
    if (!txId) {
      console.warn("[revenuecat] purchase succeeded but no transactionIdentifier surfaced", {
        hasTransaction: Boolean(tx),
        productId,
      });
    }
    return {
      ok: true,
      summary: summarize(result.customerInfo),
      transactionId: txId,
      productId,
      purchaseDateMs,
    };
  } catch (e: unknown) {
    // RC attaches `userCancelled` on the error object when the sheet was
    // dismissed. Treat that as a non-error UX-wise.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    if (err?.userCancelled || err?.code === "1" /* PURCHASE_CANCELLED */) {
      return { ok: false, cancelled: true };
    }
    console.error("[revenuecat] purchase failed", err);
    return { ok: false, error: err?.message ?? "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isRevenueCatAvailable() || !configured) {
    return { ok: false, error: "Restore is only available in the mobile app." };
  }
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return { ok: true, summary: summarize(customerInfo) };
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    console.error("[revenuecat] restore failed", err);
    return { ok: false, error: err?.message ?? "Restore failed" };
  }
}
