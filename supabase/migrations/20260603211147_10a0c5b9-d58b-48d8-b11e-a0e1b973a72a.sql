-- Remove VAPID private key storage from database (now stored in edge function secrets)
DROP TABLE IF EXISTS public.vapid_config;

-- Enforce ownership tracking on analytics events
DELETE FROM public.analytics_events WHERE user_id IS NULL;
ALTER TABLE public.analytics_events ALTER COLUMN user_id SET NOT NULL;