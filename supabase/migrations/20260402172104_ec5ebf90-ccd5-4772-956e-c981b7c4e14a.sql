
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true);

CREATE POLICY "Public read app-assets" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'app-assets');

CREATE POLICY "Admins can upload app-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'));
