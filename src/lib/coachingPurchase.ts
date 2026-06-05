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
      return {
        ok: true,
        calComUrl: (data?.calComUrl as string) ?? fallbackUrl,
        iosBookingUrl: (data?.iosBookingUrl as string | undefined) ??
          (isIos ? IOS_FALLBACK_URL : undefined),
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

