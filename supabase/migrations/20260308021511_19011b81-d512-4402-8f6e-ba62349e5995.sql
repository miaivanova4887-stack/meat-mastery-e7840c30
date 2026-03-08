
CREATE TABLE public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Page',
  slug text NOT NULL,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug)
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published pages" ON public.cms_pages
  FOR SELECT USING (published = true);

CREATE POLICY "Auth users can read own pages" ON public.cms_pages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Auth users can insert own pages" ON public.cms_pages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can update own pages" ON public.cms_pages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can delete own pages" ON public.cms_pages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
