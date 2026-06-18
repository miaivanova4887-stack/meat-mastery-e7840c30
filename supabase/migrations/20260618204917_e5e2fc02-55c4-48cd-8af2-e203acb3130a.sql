-- Public buckets are served via their public URL endpoint, which does not rely on
-- these RLS SELECT policies. Removing the broad SELECT policies prevents clients
-- from listing/enumerating all files while keeping direct public URL access intact.
DROP POLICY IF EXISTS "Public read app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read meal images" ON storage.objects;
DROP POLICY IF EXISTS "Public read recipe images" ON storage.objects;