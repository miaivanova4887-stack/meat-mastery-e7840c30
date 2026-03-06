-- Community recipes shared by users
CREATE TABLE public.community_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT 'N/A',
  cal TEXT NOT NULL DEFAULT '0',
  protein TEXT NOT NULL DEFAULT '0g',
  fat TEXT NOT NULL DEFAULT '0g',
  serving TEXT NOT NULL DEFAULT '1 serving',
  description TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  diet_tiers TEXT[] NOT NULL DEFAULT '{strict}',
  meal_type TEXT NOT NULL DEFAULT 'dinner',
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps TEXT[] NOT NULL DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read community recipes" ON public.community_recipes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert" ON public.community_recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own" ON public.community_recipes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own" ON public.community_recipes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Recipe likes
CREATE TABLE public.recipe_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.community_recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON public.recipe_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can like" ON public.recipe_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.recipe_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Function to update likes count
CREATE OR REPLACE FUNCTION public.update_recipe_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_recipes SET likes_count = likes_count + 1 WHERE id = NEW.recipe_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_recipes SET likes_count = likes_count - 1 WHERE id = OLD.recipe_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER on_recipe_like
  AFTER INSERT OR DELETE ON public.recipe_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_likes_count();