ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS health_targets text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_attributes jsonb NOT NULL DEFAULT '{}';