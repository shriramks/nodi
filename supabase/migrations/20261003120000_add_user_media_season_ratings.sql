-- Per-season personal ratings for shows, keyed by season number as text: {"1": 9, "2": 8}.
-- Kept on user_media so it shares that table's RLS and updates atomically with personal_rating.
alter table public.user_media
  add column season_ratings jsonb not null default '{}'::jsonb;
