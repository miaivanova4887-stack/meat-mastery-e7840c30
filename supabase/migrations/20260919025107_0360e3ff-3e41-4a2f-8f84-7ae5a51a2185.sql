ALTER TABLE public.device_tokens ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

CREATE TABLE public.push_anon_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token, campaign_id, scheduled_for)
);
GRANT ALL ON public.push_anon_sends TO service_role;
ALTER TABLE public.push_anon_sends ENABLE ROW LEVEL SECURITY;
-- No client policies: only edge functions (service_role) read/write this table.