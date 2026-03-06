CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (anonymous push subscriptions)
CREATE POLICY "Anyone can subscribe" ON public.push_subscriptions FOR INSERT WITH CHECK (true);

-- Allow anyone to delete their own subscription by endpoint
CREATE POLICY "Anyone can unsubscribe" ON public.push_subscriptions FOR DELETE USING (true);

-- Allow service role to select all for sending pushes
CREATE POLICY "Service can read subscriptions" ON public.push_subscriptions FOR SELECT USING (true);