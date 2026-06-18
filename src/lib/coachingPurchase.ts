/**
 * Records a completed coaching-call purchase server-side so the user gets a
 * paid session row, and returns the Cal.com scheduling URL so the UI can
 * immediately route the user to booking.
 *
 * Used by both the iOS RevenueCat/StoreKit flow and (optionally) the web
 * Stripe flow. Independent of any subscription entitlement.
 */

import { supabase } from "@/integrations/supabase/client";
import { CAL_IOS_NO_PAYMENT_URL } from "@/lib/coachingUrls";
import { openExternalUrl } from "@/lib/openExternalUrl";

/**
 * Single shared production entry point for the web/Android coaching-call
 * Stripe checkout. EVERY non-iOS coaching "Book a Call" CTA (homepage,
 * Coaching page, Pricing/My Account) MUST call this so the checkout is always
 * created by the same `create-coaching-checkout` function against the same
 * live coaching price. Do NOT re-introduce per-screen price IDs or route
 * coaching through the generic `create-checkout` function — that caused the
 * Profile/My Account path to open a stale (sandbox) coaching price.
 *
 * Returns { ok } so callers can decide how to surface a failure. The function
 * itself opens the returned Stripe URL via openExternalUrl (native-safe).
 */
export async function startCoachingStripeCheckout(opts?: {
  logTag?: string;
  /** Region hint (e.g. "US" | "CA") used to select USD vs CAD coaching price. */
  country?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-coaching-checkout",
      opts?.country ? { body: { country: opts.country } } : undefined
    );
    if (error) throw error;
    if (data?.url) {
      await openExternalUrl(data.url, {
        logTag: opts?.logTag ?? "coaching:stripe-checkout",
      });
      return { ok: true };
    }
    return { ok: false, error: "No checkout URL returned" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Couldn't open checkout";
    console.error("[startCoachingStripeCheckout] failed", e);
    return { ok: false, error: msg };
  }
}

export interface RecordCoachingPurchaseInput {
  source: "appstore" | "stripe";
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  purchaseDateMs?: number;
}

export interface RecordCoachingPurchaseResult {
  ok: boolean;
  /** Legacy field — web Stripe path uses this. iOS callers should prefer `iosBookingUrl`. */
  calComUrl?: string;
  /** Prefilled no-payment Cal.com URL for iOS-paid users. Undefined on web. */
  iosBookingUrl?: string;
  /** ID of the coaching_sessions row created (or matched on duplicate). */
  sessionRowId?: string;
  error?: string;
}

// Safe fallback for iOS so a backend failure never sends the user to the
// paid Cal.com event (which would double-charge them).
const IOS_FALLBACK_URL = CAL_IOS_NO_PAYMENT_URL;
const TIMEOUT_MS = 10_000;

export async function recordCoachingPurchase(
  input: RecordCoachingPurchaseInput
): Promise<RecordCoachingPurchaseResult> {
  const isIos = input.source === "appstore";
  const fallbackUrl = isIos ? IOS_FALLBACK_URL : undefined;

  const timeout = new Promise<RecordCoachingPurchaseResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          ok: false,
          calComUrl: fallbackUrl,
          iosBookingUrl: isIos ? IOS_FALLBACK_URL : undefined,
          error: "Recording timed out — you can still book your session.",
        }),
      TIMEOUT_MS
    )
  );

  const call = (async (): Promise<RecordCoachingPurchaseResult> => {
    console.info("[coachingPurchase] invoke start", {
      source: input.source,
      productId: input.productId,
      hasTxId: !!input.transactionId,
    });
    try {
      const { data, error } = await supabase.functions.invoke(
        "record-coaching-purchase",
        { body: input }
      );
      if (error) {
        console.error("[coachingPurchase] invoke error", error);
        return {
          ok: false,
          calComUrl: fallbackUrl,
          iosBookingUrl: isIos ? IOS_FALLBACK_URL : undefined,
          error: error.message ?? "Could not record purchase",
        };
      }
      const sessionRowId = (data?.sessionRowId as string | undefined) ?? undefined;
      console.info("[coachingPurchase] invoke ok", {
        hasCalComUrl: !!data?.calComUrl,
        hasIosBookingUrl: !!data?.iosBookingUrl,
        sessionRowId: sessionRowId ?? null,
      });
      return {
        ok: true,
        calComUrl: (data?.calComUrl as string) ?? fallbackUrl,
        iosBookingUrl: (data?.iosBookingUrl as string | undefined) ??
          (isIos ? IOS_FALLBACK_URL : undefined),
        sessionRowId,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not record purchase";
      console.error("[coachingPurchase] threw", e);
      return {
        ok: false,
        calComUrl: fallbackUrl,
        iosBookingUrl: isIos ? IOS_FALLBACK_URL : undefined,
        error: msg,
      };
    }
  })();

  return Promise.race([call, timeout]);
}

