CREATE TABLE public.vapid_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vapid_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.vapid_config FOR ALL USING (false);