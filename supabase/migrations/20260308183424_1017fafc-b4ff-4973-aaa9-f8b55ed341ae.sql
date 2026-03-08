
-- Create storage bucket for cached meal images
INSERT INTO storage.buckets (id, name, public) VALUES ('meal-images', 'meal-images', true);

-- Allow public read access
CREATE POLICY "Public read meal images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'meal-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload meal images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'meal-images');
