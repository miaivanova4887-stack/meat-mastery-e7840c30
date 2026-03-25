
-- Create page_layouts table
CREATE TABLE IF NOT EXISTS public.page_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read page layouts" ON public.page_layouts
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert page layouts" ON public.page_layouts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update page layouts" ON public.page_layouts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete page layouts" ON public.page_layouts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add unique constraint on content_blocks if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_blocks_page_section_key_locale_unique'
  ) THEN
    ALTER TABLE public.content_blocks
      ADD CONSTRAINT content_blocks_page_section_key_locale_unique
      UNIQUE (page, section, key, locale);
  END IF;
END $$;
