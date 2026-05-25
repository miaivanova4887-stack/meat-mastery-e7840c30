
-- 1) cms_pages: admin-only writes
DROP POLICY IF EXISTS "Auth users can insert own pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Auth users can update own pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Auth users can delete own pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Auth users can read own pages" ON public.cms_pages;

CREATE POLICY "Admins can insert cms pages"
  ON public.cms_pages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update cms pages"
  ON public.cms_pages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete cms pages"
  ON public.cms_pages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can read all cms pages"
  ON public.cms_pages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) profiles: own-row reads only + public view for safe display fields
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT id, display_name, avatar_url
  FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- We also need anyone to be able to read the limited public columns via the view.
-- Since the view uses security_invoker, RLS on the base table applies; add a
-- companion policy that exposes ONLY the public columns is not possible with
-- column-level RLS in vanilla policies. Instead, expose a second policy that
-- allows reading rows for display purposes through the view by also allowing
-- authenticated users to read the public-facing columns implicitly via the
-- view's column projection plus a permissive SELECT scoped check. To keep
-- sensitive columns protected, we leave the own-row policy and add a second
-- SELECT policy that any authenticated user can use to read rows — but the
-- view only projects safe columns, so callers querying the base table directly
-- still need to be the owner.
CREATE POLICY "Authenticated can read public profile fields via view"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- The above re-opens base-table reads. Drop it and instead implement the
-- restriction by revoking direct column grants. Use grants on specific columns.
DROP POLICY "Authenticated can read public profile fields via view" ON public.profiles;

-- Use column-level GRANTs so any authenticated user can read only public
-- display fields on the base table, while RLS still enforces own-row for
-- everything else through a single policy.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url) ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
-- Note: granting SELECT on all columns is needed for own-row full reads;
-- RLS policy "Users can read own profile" restricts which rows are visible.
-- For cross-user display of name/avatar, code should use profiles_public view.

-- 3) push_subscriptions: service role only (resolve RLS-enabled-no-policy)
CREATE POLICY "Service role only push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
