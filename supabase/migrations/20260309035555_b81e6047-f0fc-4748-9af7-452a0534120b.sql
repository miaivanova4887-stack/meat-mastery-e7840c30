
-- Revenue events table for Stripe webhook data (LTV & Activity Revenue)
CREATE TABLE public.revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'payment', -- payment, refund, subscription
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  stripe_event_id text UNIQUE,
  stripe_customer_id text,
  product_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for LTV queries (by user)
CREATE INDEX idx_revenue_events_user ON public.revenue_events(user_id, created_at);
-- Index for activity revenue queries (by date)
CREATE INDEX idx_revenue_events_date ON public.revenue_events(created_at);

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all revenue data
CREATE POLICY "Admins can read revenue"
  ON public.revenue_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can see own revenue events  
CREATE POLICY "Users can read own revenue"
  ON public.revenue_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert only via service role (Stripe webhooks) - no direct user inserts
-- We allow authenticated insert for demo/mock data seeding by admins
CREATE POLICY "Admins can insert revenue"
  ON public.revenue_events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
