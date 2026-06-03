-- Link push_subscriptions to the owning user
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Remove any historical rows with no owner (cannot be safely attributed)
DELETE FROM public.push_subscriptions WHERE user_id IS NULL;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

-- Allow signed-in users to read & delete their own subscriptions.
-- Writes (insert/upsert) continue to be performed by the edge function using
-- the service role, which is exempted from RLS.
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;

CREATE POLICY "Users can read own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);