ALTER TABLE public.community_recipes
  ADD COLUMN IF NOT EXISTS cuisines text[] NOT NULL DEFAULT '{}'::text[];