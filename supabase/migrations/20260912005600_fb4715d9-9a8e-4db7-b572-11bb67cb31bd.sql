REVOKE EXECUTE ON FUNCTION public.cron_secret() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cron_secret() TO service_role;