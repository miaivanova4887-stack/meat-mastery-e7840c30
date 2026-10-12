CREATE TABLE public.push_open_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid,
  push_type text,
  path text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.push_open_events TO anon, authenticated;
GRANT SELECT ON public.push_open_events TO authenticated;
GRANT ALL ON public.push_open_events TO service_role;
ALTER TABLE public.push_open_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record push opens" ON public.push_open_events FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND length(device_id) <= 64 AND coalesce(length(path),0) <= 300 AND coalesce(length(push_type),0) <= 80);
CREATE POLICY "Admins read push opens" ON public.push_open_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_push_open_events_created ON public.push_open_events (created_at DESC);