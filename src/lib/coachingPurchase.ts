/**
 * Records a completed coaching-call purchase server-side so the user gets a
 * paid session row, and returns the Cal.com scheduling URL so the UI can
 * immediately route the user to booking.
 *
 * Used by both the iOS RevenueCat/StoreKit flow and (optionally) the web
 * Stripe flow. Independent of any subscription entitlement.
 */

import { supabase } from "@/integrations/supabase/client";

export interface RecordCoachingPurchaseInput {
  source: "appstore" | "stripe";
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  purchaseDateMs?: number;
}

export interface RecordCoachingPurchaseResult {
  ok: boolean;
  calComUrl?: string;
  error?: string;
}

const DEFAULT_CAL_URL = "https://cal.com/carnivorex/coaching-session";
const TIMEOUT_MS = 10_000;

export async function recordCoachingPurchase(
  input: RecordCoachingPurchaseInput
): Promise<RecordCoachingPurchaseResult> {
  const timeout = new Promise<RecordCoachingPurchaseResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          ok: false,
          calComUrl: DEFAULT_CAL_URL,
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
          calComUrl: DEFAULT_CAL_URL,
          error: error.message ?? "Could not record purchase",
        };
      }
      return {
        ok: true,
        calComUrl: (data?.calComUrl as string) ?? DEFAULT_CAL_URL,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not record purchase";
      console.error("[coachingPurchase] threw", e);
      return { ok: false, calComUrl: DEFAULT_CAL_URL, error: msg };
    }
  })();

  return Promise.race([call, timeout]);
}
