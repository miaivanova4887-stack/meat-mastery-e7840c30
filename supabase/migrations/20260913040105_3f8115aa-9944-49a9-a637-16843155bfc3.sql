CREATE TABLE public.manual_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('pro','elite')),
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT ON public.manual_entitlements TO authenticated;
GRANT ALL ON public.manual_entitlements TO service_role;

ALTER TABLE public.manual_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own manual entitlement"
ON public.manual_entitlements FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all manual entitlements"
ON public.manual_entitlements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage manual entitlements"
ON public.manual_entitlements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER manual_entitlements_touch
BEFORE UPDATE ON public.manual_entitlements
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.manual_entitlements (user_id, tier, note)
VALUES ('5eb3afab-59dd-4a60-9afa-0ae948c0b4e0', 'pro', 'Manually granted Pro access');