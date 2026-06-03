CREATE OR REPLACE FUNCTION public.normalize_profile_locale()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.locale IS NULL OR NEW.locale = '' THEN
    NEW.locale := 'en';
  ELSIF lower(NEW.locale) LIKE 'fr%' THEN
    NEW.locale := 'fr';
  ELSE
    NEW.locale := 'en';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_locale_trigger ON public.profiles;
CREATE TRIGGER normalize_profile_locale_trigger
BEFORE INSERT OR UPDATE OF locale ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_locale();

UPDATE public.profiles
SET locale = CASE WHEN lower(locale) LIKE 'fr%' THEN 'fr' ELSE 'en' END
WHERE locale NOT IN ('en', 'fr') OR locale IS NULL;