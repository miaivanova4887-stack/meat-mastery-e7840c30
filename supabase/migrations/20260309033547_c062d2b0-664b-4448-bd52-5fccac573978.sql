
-- Create admin notifications table for feed + push
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  target_preferences jsonb NOT NULL DEFAULT '{}',
  sent_push boolean NOT NULL DEFAULT false,
  sent_feed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage notifications
CREATE POLICY "Admins can manage notifications"
  ON public.admin_notifications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read notifications (for feed)
CREATE POLICY "Users can read notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (true);
