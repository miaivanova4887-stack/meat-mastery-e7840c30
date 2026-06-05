/**
 * Cal.com event URLs for coaching.
 *
 * - PAID URL: used by the web Stripe flow ONLY. Cal.com collects payment.
 * - IOS NO-PAYMENT URL: used after a successful StoreKit/RevenueCat purchase.
 *   This event MUST be configured in Cal.com with payment disabled, otherwise
 *   users will be double-charged (Apple + Cal.com).
 *
 * The backend `record-coaching-purchase` function appends ?name=&email= to
 * prefill the Cal.com form for iOS users; these constants are the bare URLs.
 */
export const CAL_PAID_URL = "https://cal.com/carnivorex/coaching-session";
export const CAL_IOS_NO_PAYMENT_URL = "https://cal.com/carnivorex/coaching-session-ios";

export interface BuildCalUrlOptions {
  base: string;
  userId?: string | null;
  sessionRowId?: string | null;
  name?: string | null;
  email?: string | null;
}

/**
 * Build a Cal.com booking URL with prefill + metadata.
 *
 * Cal.com forwards `metadata[*]` query params into the booking webhook
 * payload's `payload.metadata` object. We use this to embed our internal
 * `user_id` so the `cal-webhook` edge function can link the booking back
 * to the correct account even when the user books with a different email
 * than they signed up with (e.g. Apple private relay).
 */
export function buildCalUrl({
  base,
  userId,
  sessionRowId,
  name,
  email,
}: BuildCalUrlOptions): string {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (email) params.set("email", email);
  if (userId) params.set("metadata[user_id]", userId);
  if (sessionRowId) params.set("metadata[session_row_id]", sessionRowId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
