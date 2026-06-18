-- 1) page_layouts: stop exposing unpublished/draft layouts to the public
DROP POLICY IF EXISTS "Anyone can read page layouts" ON public.page_layouts;

CREATE POLICY "Anyone can read published page layouts"
  ON public.page_layouts
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins can read all page layouts"
  ON public.page_layouts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) coaching_sessions: allow admins to read all sessions for operational support
CREATE POLICY "Admins can read all coaching sessions"
  ON public.coaching_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Lock down SECURITY DEFINER helper functions so they are not callable
--    by anon/authenticated via the Data API. These run only from triggers
--    or trusted edge functions (service role).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;

-- Trigger-only functions never need direct EXECUTE from API roles
REVOKE EXECUTE ON FUNCTION public.sync_profile_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_recipe_likes_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_post_likes_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_profile_locale() FROM anon, authenticated;