CREATE TABLE public.content_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id text NOT NULL,
  content_type text NOT NULL DEFAULT 'article',
  reaction text NOT NULL,
  theme text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id, reaction)
);
GRANT SELECT, INSERT, DELETE ON public.content_reactions TO authenticated;
GRANT ALL ON public.content_reactions TO service_role;
ALTER TABLE public.content_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reactions" ON public.content_reactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reactions" ON public.content_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reactions" ON public.content_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_content_reactions_user ON public.content_reactions(user_id, reaction);