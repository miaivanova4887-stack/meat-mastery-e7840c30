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
