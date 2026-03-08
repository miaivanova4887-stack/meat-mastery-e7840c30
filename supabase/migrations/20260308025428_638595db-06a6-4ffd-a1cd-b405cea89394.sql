
-- Progress entries table: stores all tracking data for all categories
CREATE TABLE public.progress_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL, -- 'diet_trends', 'body_measurements', 'vitals', 'mood', 'symptoms'
  metric text NOT NULL,   -- e.g. 'weight', 'blood_pressure_systolic', 'mood_score', etc.
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Progress goals table: user-defined targets per metric
CREATE TABLE public.progress_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  metric text NOT NULL,
  target_value numeric NOT NULL,
  unit text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, metric)
);

-- Enable RLS
ALTER TABLE public.progress_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for progress_entries
CREATE POLICY "Users can read own entries" ON public.progress_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON public.progress_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries" ON public.progress_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries" ON public.progress_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for progress_goals
CREATE POLICY "Users can read own goals" ON public.progress_goals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON public.progress_goals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON public.progress_goals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON public.progress_goals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Index for fast queries
CREATE INDEX idx_progress_entries_user_cat ON public.progress_entries(user_id, category, recorded_at DESC);
CREATE INDEX idx_progress_goals_user ON public.progress_goals(user_id, category);
