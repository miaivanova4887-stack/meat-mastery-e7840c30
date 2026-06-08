-- Restrict sensitive Stripe payment identifiers to service_role only.
-- Owners can still SELECT the row (RLS unchanged) but cannot read these columns.
REVOKE SELECT (stripe_payment_intent, transaction_id) ON public.coaching_sessions FROM authenticated;
REVOKE SELECT (stripe_payment_intent, transaction_id) ON public.coaching_sessions FROM anon;

-- Keep service_role with full column access (no-op safety grant).
GRANT SELECT ON public.coaching_sessions TO service_role;