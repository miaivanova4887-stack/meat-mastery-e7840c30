-- Move the internal job token out of the API-exposed schema entirely.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.internal_config FROM anon, authenticated;
GRANT ALL ON private.internal_config TO service_role;

INSERT INTO private.internal_config (key, value)
SELECT key, value FROM public.internal_config
ON CONFLICT (key) DO NOTHING;

INSERT INTO private.internal_config (key, value)
VALUES ('cron_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

DROP TABLE IF EXISTS public.internal_config;