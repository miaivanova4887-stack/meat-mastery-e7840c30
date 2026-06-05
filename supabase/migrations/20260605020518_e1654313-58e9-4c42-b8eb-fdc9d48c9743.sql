ALTER TABLE public.coaching_sessions
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS coaching_sessions_user_txn_unique
  ON public.coaching_sessions (user_id, transaction_id)
  WHERE transaction_id IS NOT NULL;