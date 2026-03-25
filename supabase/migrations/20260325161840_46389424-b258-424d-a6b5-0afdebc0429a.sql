
ALTER TABLE community_recipes ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read recipe images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'recipe-images');

CREATE POLICY "Auth users upload own recipe images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own recipe images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
