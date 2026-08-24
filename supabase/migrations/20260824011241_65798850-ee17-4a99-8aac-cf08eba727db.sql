-- 1. Admin read access to coaching reminder log (writes remain service-role only)
CREATE POLICY "Admins can read all reminder logs"
ON public.coaching_reminder_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Admin read access to profiles for support workflows
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Harden coaching_sessions: block tampering with payment/booking columns
--    from any non-service-role path, even if an UPDATE policy is added later.
CREATE OR REPLACE FUNCTION public.protect_coaching_session_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.stripe_payment_intent IS DISTINCT FROM OLD.stripe_payment_intent
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.external_booking_id IS DISTINCT FROM OLD.external_booking_id
     OR NEW.session_type IS DISTINCT FROM OLD.session_type
     OR NEW.session_month IS DISTINCT FROM OLD.session_month
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'Payment and booking fields cannot be modified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_coaching_session_payment_fields ON public.coaching_sessions;
CREATE TRIGGER protect_coaching_session_payment_fields
BEFORE UPDATE ON public.coaching_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_coaching_session_payment_fields();

-- 4. Ensure users cannot update coaching sessions at all through the API
REVOKE UPDATE, DELETE ON public.coaching_sessions FROM authenticated;
REVOKE UPDATE, DELETE ON public.coaching_sessions FROM anon;
GRANT ALL ON public.coaching_sessions TO service_role;

-- 5. push_campaigns stays admin-only; guarantee schedulers keep full access
GRANT ALL ON public.push_campaigns TO service_role;
GRANT ALL ON public.coaching_reminder_log TO service_role;