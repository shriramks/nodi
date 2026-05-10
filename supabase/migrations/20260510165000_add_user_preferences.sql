-- user_preferences: one row per user, stores app-level personal settings.
-- Currently: co_watch_tag (Todo 1) and theme (Todo 2).

CREATE TABLE public.user_preferences (
  user_id   uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  co_watch_tag text     NULL,
  theme      text       NULL CHECK (theme IN ('light', 'dark')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
