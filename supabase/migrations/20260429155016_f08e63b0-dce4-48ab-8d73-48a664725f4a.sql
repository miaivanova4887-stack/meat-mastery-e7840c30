-- 1. Profiles: consent + preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_consent text NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS push_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"streaks":true,"recipes":true,"fasting":true,"coaching":true,"marketing":false}'::jsonb;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_push_consent_check
  CHECK (push_consent IN ('unset','granted','denied'));

-- 2. Device tokens (FCM / web push)
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android','ios','web')),
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS device_tokens_platform_idx ON public.device_tokens(platform);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens select"
  ON public.device_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own device tokens insert"
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own device tokens update"
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own device tokens delete"
  ON public.device_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Push campaigns
CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  trigger_type text NOT NULL CHECK (trigger_type IN ('event','attribute','manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_campaigns_active_idx ON public.push_campaigns(active);
CREATE INDEX IF NOT EXISTS push_campaigns_trigger_type_idx ON public.push_campaigns(trigger_type);

ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage push campaigns"
  ON public.push_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Push campaign runs
CREATE TABLE IF NOT EXISTS public.push_campaign_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_step int NOT NULL DEFAULT 0,
  next_send_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled','failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS push_campaign_runs_due_idx
  ON public.push_campaign_runs(status, next_send_at);
CREATE INDEX IF NOT EXISTS push_campaign_runs_user_idx
  ON public.push_campaign_runs(user_id);

ALTER TABLE public.push_campaign_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all campaign runs"
  ON public.push_campaign_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own campaign runs"
  ON public.push_campaign_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_campaigns_touch ON public.push_campaigns;
CREATE TRIGGER push_campaigns_touch
  BEFORE UPDATE ON public.push_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS push_campaign_runs_touch ON public.push_campaign_runs;
CREATE TRIGGER push_campaign_runs_touch
  BEFORE UPDATE ON public.push_campaign_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();