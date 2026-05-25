-- 1) profiles: remove public read; keep authenticated-only read
DROP POLICY IF EXISTS "Users can read any profile" ON public.profiles;

-- 2) admin_notifications: only admins can read
DROP POLICY IF EXISTS "Users can read notifications" ON public.admin_notifications;

-- 3) push_subscriptions: lock down (only service_role via edge functions)
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can unsubscribe" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service can read subscriptions" ON public.push_subscriptions;

-- 4) storage: explicit UPDATE policy mirroring INSERT on recipe-images
DROP POLICY IF EXISTS "Users update own recipe images" ON storage.objects;
CREATE POLICY "Users update own recipe images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5) Pin search_path on SECURITY DEFINER queue helpers and revoke EXECUTE
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;