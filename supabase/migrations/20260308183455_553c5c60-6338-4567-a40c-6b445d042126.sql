
-- Fix: restrict upload to service role only (edge function uses service role key)
DROP POLICY "Authenticated upload meal images" ON storage.objects;
CREATE POLICY "Service role upload meal images" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'meal-images');
