/**
 * AppsFlyer analytics wrapper.
 *
 * Centralized so callers never import `appsflyer-capacitor-plugin` directly.
 * On web (Vite preview, published web build) every call is a no-op.
 *
 * Init is fired from `src/main.tsx` on cold launch. Event helpers are safe
 * to call before init resolves — the plugin queues them internally.
 *
 * Revenue de-duplication
 * ----------------------
 * RevenueCat → AppsFlyer S2S can already report `af_purchase` on the
 * server side. To avoid double counting revenue, client-side purchase
 * events ship WITHOUT `af_revenue` by default. Flip the flag below to
 * `true` ONLY if you've confirmed the RC→AppsFlyer integration is
 * disabled in the AppsFlyer dashboard.
 */

import { Capacitor } from "@capacitor/core";
import { AppsFlyer, AFConstants } from "appsflyer-capacitor-plugin";

// ---------------------------------------------------------------------------
// Configuration — these are client-side identifiers, not server secrets.
// Same handling pattern as the Supabase publishable key + Firebase config.
// ---------------------------------------------------------------------------
const AF_DEV_KEY = "Uk5UhKPSaBzxQTYfqDWZsj";
const AF_IOS_APP_ID = "6762581416"; // numeric (no "id" prefix)

/** Set to true only if RC→AppsFlyer S2S purchase reporting is OFF. */
export const AF_CLIENT_REVENUE_ENABLED = false;

const isNative = () => Capacitor.isNativePlatform();
const isDev = import.meta.env.DEV;

let initPromise: Promise<void> | null = null;

/** Idempotent init. Safe to call multiple times. No-op on web. */
export function initAppsFlyer(): Promise<void> {
  if (initPromise) return initPromise;
  if (!isNative()) {
    initPromise = Promise.resolve();
    return initPromise;
  }
  initPromise = (async () => {
    try {
      // Conversion + deep-link listeners — log only, never navigate, so they
      // can't conflict with the existing useDeepLinks / usePushNavigation
      // routing in App.tsx.
      AppsFlyer.addListener(AFConstants.CONVERSION_CALLBACK, (e) => {
        if (isDev) console.info("[AppsFlyer] conversion", e);
      });
      AppsFlyer.addListener(AFConstants.OAOA_CALLBACK, (e) => {
        if (isDev) console.info("[AppsFlyer] app-open-attribution", e);
      });
      AppsFlyer.addListener(AFConstants.UDL_CALLBACK, (e) => {
        if (isDev) console.info("[AppsFlyer] unified-deeplink", e);
      });

      await AppsFlyer.initSDK({
        devKey: AF_DEV_KEY,
        appID: AF_IOS_APP_ID,
        isDebug: isDev,
        waitForATTUserAuthorization: 0,
        minTimeBetweenSessions: 4,
        registerConversionListener: true,
        registerOnAppOpenAttribution: true,
        registerOnDeepLink: true,
      });
      if (isDev) console.info("[AppsFlyer] initSDK ok");
    } catch (e) {
      console.warn("[AppsFlyer] initSDK failed", e);
    }
  })();
  return initPromise;
}

/** Associate the AppsFlyer customer user id with the signed-in Supabase user. */
export function setAppsFlyerUserId(userId: string | null): void {
  if (!isNative()) return;
  void (async () => {
    try {
      if (userId) await AppsFlyer.setCustomerUserId({ cuid: userId });
    } catch (e) {
      if (isDev) console.warn("[AppsFlyer] setCustomerUserId failed", e);
    }
  })();
}

/** Fire-and-forget event log. No-op + console.debug on web. */
export function logAfEvent(
  eventName: string,
  eventValue?: Record<string, unknown>
): void {
  if (!isNative()) {
    if (isDev) console.debug("[AppsFlyer:web-noop]", eventName, eventValue ?? {});
    return;
  }
  void (async () => {
    try {
      await AppsFlyer.logEvent({ eventName, eventValue: eventValue ?? {} });
      if (isDev) console.info("[AppsFlyer] event", eventName, eventValue ?? {});
    } catch (e) {
      if (isDev) console.warn("[AppsFlyer] logEvent failed", eventName, e);
    }
  })();
}

// ---------------------------------------------------------------------------
// Event name catalogue. Prefix `af_` = AppsFlyer predefined names.
// Anything else = custom snake_case CarnivoreX event.
// ---------------------------------------------------------------------------
export const AF_EVENTS = {
  login: "af_login",
  completeRegistration: "af_complete_registration",
  initiatedCheckout: "af_initiated_checkout",
  purchase: "af_purchase",
  onboardingCompleted: "onboarding_completed",
  paywallViewed: "paywall_viewed",
  subscriptionStarted: "subscription_started",
  coachingCtaTapped: "coaching_cta_tapped",
  coachingPurchaseSuccess: "coaching_purchase_success",
  coachingBookingCompleted: "coaching_booking_completed",
  mealPlanGenerated: "meal_plan_generated",
  progressLogged: "progress_logged",
} as const;

// AppsFlyer predefined event-param keys.
export const AF_PARAMS = {
  revenue: "af_revenue",
  currency: "af_currency",
  contentId: "af_content_id",
  contentType: "af_content_type",
  orderId: "af_order_id",
  registrationMethod: "af_registration_method",
  loginMethod: "af_login_method",
} as const;

/** Build a purchase param map that respects the revenue-dedup flag. */
export function buildPurchaseParams(input: {
  productId: string;
  productType?: string;
  price?: number | string | null;
  currency?: string | null;
  store?: string | null;
  orderId?: string | null;
  storefrontCountry?: string | null;
  sourceScreen?: string | null;
}): Record<string, unknown> {
  const params: Record<string, unknown> = {
    [AF_PARAMS.contentId]: input.productId,
  };
  if (input.productType) params[AF_PARAMS.contentType] = input.productType;
  if (input.orderId) params[AF_PARAMS.orderId] = input.orderId;
  if (input.currency) params[AF_PARAMS.currency] = input.currency;
  if (input.store) params.store = input.store;
  if (input.storefrontCountry) params.storefront_country = input.storefrontCountry;
  if (input.sourceScreen) params.source_screen = input.sourceScreen;
  if (AF_CLIENT_REVENUE_ENABLED && input.price != null && input.price !== "") {
    const n = typeof input.price === "number" ? input.price : Number(input.price);
    if (Number.isFinite(n)) params[AF_PARAMS.revenue] = n;
  }
  return params;
}
