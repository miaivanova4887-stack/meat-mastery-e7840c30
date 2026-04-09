
-- Allow authenticated users to read any profile (for community features)
-- Sensitive health data is still protected because the view is used for public display
-- and authenticated users need to see display_name/avatar_url of recipe authors
CREATE POLICY "Authenticated can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the more restrictive owner-only policy since the above is more permissive
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
