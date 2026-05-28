-- Backfill movie data added between the initial media migration (20260526110000)
-- and the movie write-path sync fix (20260528 task 141) into the new media tables.
-- Movies added during that window landed in movies/user_movies/watch_logs but not
-- in media_items/user_media/media_watch_activity.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.

-- 1. media_items — sync any movies row missing from media_items
insert into public.media_items (
  id,
  type,
  title,
  original_title,
  release_date,
  first_air_date,
  primary_genre_id,
  primary_genre_name,
  original_language,
  overview,
  poster_path,
  backdrop_path,
  runtime_minutes,
  tmdb_vote_average,
  tmdb_vote_count,
  popularity,
  metadata_updated_at,
  tmdb_enriched_at,
  created_at
)
select
  m.id,
  'movie',
  m.title,
  m.original_title,
  m.release_date,
  null,
  m.primary_genre_id,
  m.primary_genre_name,
  m.original_language,
  m.overview,
  m.poster_path,
  m.backdrop_path,
  m.runtime_minutes,
  m.tmdb_vote_average,
  m.tmdb_vote_count,
  m.popularity,
  m.metadata_updated_at,
  m.tmdb_enriched_at,
  m.created_at
from public.movies m
where not exists (
  select 1 from public.media_items mi where mi.id = m.id
)
on conflict (id) do nothing;

-- 2. media_provider_mappings — sync legacy provider_mappings for newly added movies
insert into public.media_provider_mappings (
  media_id,
  episode_id,
  provider,
  provider_media_type,
  provider_id,
  created_at
)
select
  pm.movie_id,
  null,
  pm.provider,
  'movie',
  pm.provider_movie_id,
  pm.created_at
from public.provider_mappings pm
where not exists (
  select 1
  from public.media_provider_mappings mpm
  where mpm.provider = pm.provider
    and mpm.provider_media_type = 'movie'
    and mpm.provider_id = pm.provider_movie_id
)
on conflict (provider, provider_media_type, provider_id) do nothing;

-- 3. user_media — sync user_movies entries missing from user_media
-- Maps: 'to_watch' → 'wishlist', 'watched' → 'done' (matching constraint from 20260528100000)
insert into public.user_media (
  id,
  user_id,
  media_id,
  status,
  personal_rating,
  added_at,
  watchlisted_at,
  last_watched_at,
  completed_at,
  completion_mode,
  updated_at
)
select
  um.id,
  um.user_id,
  um.movie_id,
  case
    when um.status = 'to_watch' then 'wishlist'
    else 'done'
  end,
  um.personal_rating,
  um.added_at,
  um.watchlisted_at,
  um.last_watched_at,
  case when um.status = 'watched' then um.last_watched_at else null end,
  case when um.status = 'watched' then 'manual' else null end,
  um.updated_at
from public.user_movies um
-- only include movies that are now in media_items
join public.media_items mi on mi.id = um.movie_id
where not exists (
  select 1 from public.user_media uma where uma.id = um.id
)
on conflict (id) do nothing;

-- 4. user_media_tags — sync user_movie_tags entries missing from user_media_tags
insert into public.user_media_tags (
  user_id,
  media_id,
  tag_id,
  created_at
)
select
  umt.user_id,
  umt.movie_id,
  umt.tag_id,
  umt.created_at
from public.user_movie_tags umt
join public.media_items mi on mi.id = umt.movie_id
where not exists (
  select 1
  from public.user_media_tags umat
  where umat.user_id = umt.user_id
    and umat.media_id = umt.movie_id
    and umat.tag_id = umt.tag_id
)
on conflict (user_id, media_id, tag_id) do nothing;

-- 5. media_watch_activity — sync watch_logs entries missing from media_watch_activity
-- Uses legacy_watch_log_id to link back; same UUID as the watch_log row.
insert into public.media_watch_activity (
  id,
  user_id,
  media_id,
  episode_id,
  watched_at,
  source,
  provider_event_id,
  notes,
  legacy_watch_log_id,
  created_at
)
select
  wl.id,
  wl.user_id,
  wl.movie_id,
  null,
  wl.watched_at,
  wl.source,
  wl.provider_event_id,
  wl.notes,
  wl.id,
  wl.created_at
from public.watch_logs wl
join public.media_items mi on mi.id = wl.movie_id and mi.type = 'movie'
where not exists (
  select 1 from public.media_watch_activity mwa where mwa.legacy_watch_log_id = wl.id
)
on conflict (id) do nothing;
