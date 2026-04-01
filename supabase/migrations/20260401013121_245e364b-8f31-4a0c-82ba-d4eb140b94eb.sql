CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_type text NOT NULL,
  stripe_payment_intent text,
  booked_at timestamptz DEFAULT now(),
  session_month text NOT NULL
);
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own sessions" ON public.coaching_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sessions" ON public.coaching_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());