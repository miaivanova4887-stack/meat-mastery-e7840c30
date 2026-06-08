CREATE POLICY "Service role update meal images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'meal-images')
WITH CHECK (bucket_id = 'meal-images');

CREATE POLICY "Service role delete meal images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'meal-images');