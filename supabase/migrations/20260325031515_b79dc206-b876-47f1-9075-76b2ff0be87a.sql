
CREATE TABLE public.content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  section text NOT NULL,
  key text NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'link', 'image_url')),
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr')),
  value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (page, section, key, locale)
);

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read content blocks"
  ON public.content_blocks
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert content blocks"
  ON public.content_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update content blocks"
  ON public.content_blocks
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete content blocks"
  ON public.content_blocks
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
