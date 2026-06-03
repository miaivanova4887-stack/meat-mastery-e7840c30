
-- Widen trigger_type to include 'scheduled'
DO $$
DECLARE c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.push_campaigns'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%trigger_type%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.push_campaigns DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE public.push_campaigns
  ADD CONSTRAINT push_campaigns_trigger_type_check
  CHECK (trigger_type IN ('event','manual','scheduled'));

-- profiles: timezone + locale
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"fasting": true, "recipes": true, "streaks": true, "coaching": true, "marketing": false, "daily_meal_reminder": false, "streak_reminder": false, "weekly_summary": false, "reminder_time": "19:00"}'::jsonb;

UPDATE public.profiles
SET notification_preferences =
  jsonb_build_object(
    'daily_meal_reminder', false,
    'streak_reminder', false,
    'weekly_summary', false,
    'reminder_time', '19:00'
  ) || COALESCE(notification_preferences, '{}'::jsonb)
WHERE NOT (notification_preferences ? 'daily_meal_reminder')
   OR NOT (notification_preferences ? 'streak_reminder')
   OR NOT (notification_preferences ? 'weekly_summary')
   OR NOT (notification_preferences ? 'reminder_time');

-- push_campaigns: schedule JSON
ALTER TABLE public.push_campaigns
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{}'::jsonb;

-- push_campaign_runs: per-occurrence dedupe
ALTER TABLE public.push_campaign_runs
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_campaign_runs_campaign_id_user_id_key'
  ) THEN
    ALTER TABLE public.push_campaign_runs
      DROP CONSTRAINT push_campaign_runs_campaign_id_user_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS push_campaign_runs_unique_occurrence
  ON public.push_campaign_runs (
    campaign_id,
    user_id,
    COALESCE(scheduled_for, 'epoch'::timestamptz)
  );

-- Seed campaigns (idempotent)
INSERT INTO public.push_campaigns (name, description, trigger_type, schedule, segment, steps, active)
SELECT 'Daily meal reminder',
  'Once-a-day nudge to log meals (gated by notification_preferences.daily_meal_reminder).',
  'scheduled',
  '{"kind":"daily","local_time":"19:00","preference_key":"daily_meal_reminder","use_profile_reminder_time":true}'::jsonb,
  '{}'::jsonb,
  '[{"title":{"en":"Log your meals today","fr":"Enregistrez vos repas aujourd''hui"},"body":{"en":"Stay consistent — add your meals and keep your progress on track.","fr":"Restez constant(e) — ajoutez vos repas et gardez le cap sur vos progrès."},"data":{"url":"/progress"}}]'::jsonb,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.push_campaigns WHERE name = 'Daily meal reminder');

INSERT INTO public.push_campaigns (name, description, trigger_type, schedule, segment, steps, active)
SELECT 'Streak reminder',
  'Daily nudge to keep streak alive (gated by notification_preferences.streak_reminder).',
  'scheduled',
  '{"kind":"daily","local_time":"20:00","preference_key":"streak_reminder"}'::jsonb,
  '{}'::jsonb,
  '[{"title":{"en":"Keep your streak going","fr":"Maintenez votre série"},"body":{"en":"You''re on a roll — log today''s progress to maintain your streak.","fr":"Vous êtes sur une belle lancée — enregistrez votre journée pour garder votre série."},"data":{"url":"/progress"}}]'::jsonb,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.push_campaigns WHERE name = 'Streak reminder');

INSERT INTO public.push_campaigns (name, description, trigger_type, schedule, segment, steps, active)
SELECT 'Weekly progress summary',
  'Sunday evening recap (gated by notification_preferences.weekly_summary).',
  'scheduled',
  '{"kind":"weekly","weekday":0,"local_time":"18:00","preference_key":"weekly_summary"}'::jsonb,
  '{}'::jsonb,
  '[{"title":{"en":"Your weekly progress is ready","fr":"Votre résumé hebdomadaire est prêt"},"body":{"en":"Open the app to review your week and plan your next steps.","fr":"Ouvrez l''application pour revoir votre semaine et planifier la suite."},"data":{"url":"/progress"}}]'::jsonb,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.push_campaigns WHERE name = 'Weekly progress summary');
