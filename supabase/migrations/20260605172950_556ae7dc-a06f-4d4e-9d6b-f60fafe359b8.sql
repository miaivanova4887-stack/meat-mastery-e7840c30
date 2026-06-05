ALTER TABLE public.coaching_sessions
  ADD COLUMN IF NOT EXISTS unscheduled_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unscheduled_reminder_last_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS coaching_sessions_pending_nudge_idx
  ON public.coaching_sessions (status, unscheduled_reminder_last_sent_at)
  WHERE status = 'pending';