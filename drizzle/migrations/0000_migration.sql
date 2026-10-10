CREATE TABLE public.onboarding_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid,
  event_type text NOT NULL,
  step integer,
  question text,
  answers text[] NOT NULL DEFAULT '{}',
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.onboarding_insights TO anon, authenticated;
GRANT SELECT ON public.onboarding_insights TO authenticated;
GRANT ALL ON public.onboarding_insights TO service_role;
ALTER TABLE public.onboarding_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record onboarding events" ON public.onboarding_insights
  FOR INSERT TO anon, authenticated
  WITH CHECK (event_type IN ('step_answered','completed','skipped') AND (user_id IS NULL OR user_id = auth.uid()) AND length(device_id) <= 64 AND coalesce(array_length(answers,1),0) <= 40);
CREATE POLICY "Admins can read onboarding events" ON public.onboarding_insights
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX onboarding_insights_created_idx ON public.onboarding_insights (created_at DESC);