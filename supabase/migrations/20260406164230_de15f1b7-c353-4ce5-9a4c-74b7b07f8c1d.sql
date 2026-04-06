ALTER TABLE public.profiles
ADD COLUMN wellness_disclaimer_consented boolean NOT NULL DEFAULT false,
ADD COLUMN wellness_disclaimer_consented_at timestamptz,
ADD COLUMN wellness_disclaimer_version text;