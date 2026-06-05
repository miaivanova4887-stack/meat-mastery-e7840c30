
-- profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_offset_minutes integer NOT NULL DEFAULT 60;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_reminder_offset_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reminder_offset_chk
  CHECK (reminder_offset_minutes IN (15, 30, 60, 120, 1440));

-- Backfill email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));

-- Keep handle_new_user filling email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- Mirror email updates from auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_email_trg ON auth.users;
CREATE TRIGGER sync_profile_email_trg
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- coaching_sessions extensions
ALTER TABLE public.coaching_sessions
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS external_booking_id text,
  ADD COLUMN IF NOT EXISTS attendee_email text,
  ADD COLUMN IF NOT EXISTS attendee_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.coaching_sessions
  DROP CONSTRAINT IF EXISTS coaching_sessions_status_chk;
ALTER TABLE public.coaching_sessions
  ADD CONSTRAINT coaching_sessions_status_chk
  CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled', 'no_show'));

CREATE UNIQUE INDEX IF NOT EXISTS coaching_sessions_external_booking_id_uniq
  ON public.coaching_sessions (external_booking_id)
  WHERE external_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coaching_sessions_status_scheduled_idx
  ON public.coaching_sessions (status, scheduled_at);

-- updated_at trigger
DROP TRIGGER IF EXISTS coaching_sessions_touch ON public.coaching_sessions;
CREATE TRIGGER coaching_sessions_touch
BEFORE UPDATE ON public.coaching_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Allow service_role full access for webhook upserts
GRANT ALL ON public.coaching_sessions TO service_role;

-- coaching_reminder_log
CREATE TABLE IF NOT EXISTS public.coaching_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  offset_minutes integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'push',
  success boolean NOT NULL DEFAULT true,
  error text,
  UNIQUE (session_id, offset_minutes)
);

GRANT SELECT ON public.coaching_reminder_log TO authenticated;
GRANT ALL ON public.coaching_reminder_log TO service_role;

ALTER TABLE public.coaching_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own reminder log" ON public.coaching_reminder_log;
CREATE POLICY "Users read own reminder log"
ON public.coaching_reminder_log
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
