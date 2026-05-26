-- Backfill existing movie metadata and per-user movie state into the additive media tables.
-- Movie-facing reads and writes remain on the existing movie tables after this migration.

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
  id,
  'movie',
  title,
  original_title,
  release_date,
  null,
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
from public.movies
on conflict (id) do update
set
  type = excluded.type,
  title = excluded.title,
  original_title = excluded.original_title,
  release_date = excluded.release_date,
  first_air_date = excluded.first_air_date,
  primary_genre_id = excluded.primary_genre_id,
  primary_genre_name = excluded.primary_genre_name,
  original_language = excluded.original_language,
  overview = excluded.overview,
  poster_path = excluded.poster_path,
  backdrop_path = excluded.backdrop_path,
  runtime_minutes = excluded.runtime_minutes,
  tmdb_vote_average = excluded.tmdb_vote_average,
  tmdb_vote_count = excluded.tmdb_vote_count,
  popularity = excluded.popularity,
  metadata_updated_at = excluded.metadata_updated_at,
  tmdb_enriched_at = excluded.tmdb_enriched_at,
  created_at = excluded.created_at;

insert into public.media_provider_mappings (
  media_id,
  episode_id,
  provider,
  provider_media_type,
  provider_id,
  created_at
)
select
  movie_id,
  null,
  provider,
  'movie',
  provider_movie_id,
  created_at
from public.provider_mappings
on conflict (provider, provider_media_type, provider_id) do update
set
  media_id = excluded.media_id,
  episode_id = excluded.episode_id,
  created_at = excluded.created_at;

insert into public.media_provider_mappings (
  media_id,
  episode_id,
  provider,
  provider_media_type,
  provider_id,
  created_at
)
select
  id,
  null,
  'tmdb',
  'movie',
  tmdb_id::text,
  created_at
from public.movies
on conflict (provider, provider_media_type, provider_id) do update
set
  media_id = excluded.media_id,
  episode_id = excluded.episode_id,
  created_at = excluded.created_at;

insert into public.media_provider_mappings (
  media_id,
  episode_id,
  provider,
  provider_media_type,
  provider_id,
  created_at
)
select
  id,
  null,
  'imdb',
  'movie',
  imdb_id,
  created_at
from public.movies
where imdb_id is not null
on conflict (provider, provider_media_type, provider_id) do update
set
  media_id = excluded.media_id,
  episode_id = excluded.episode_id,
  created_at = excluded.created_at;

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
  id,
  user_id,
  movie_id,
  case
    when status = 'to_watch' then 'wishlist'
    else status
  end,
  personal_rating,
  added_at,
  watchlisted_at,
  last_watched_at,
  case
    when status = 'watched' then last_watched_at
    else null
  end,
  case
    when status = 'watched' then 'manual'
    else null
  end,
  updated_at
from public.user_movies
on conflict (id) do update
set
  user_id = excluded.user_id,
  media_id = excluded.media_id,
  status = excluded.status,
  personal_rating = excluded.personal_rating,
  added_at = excluded.added_at,
  watchlisted_at = excluded.watchlisted_at,
  last_watched_at = excluded.last_watched_at,
  completed_at = excluded.completed_at,
  completion_mode = excluded.completion_mode,
  updated_at = excluded.updated_at;

insert into public.user_media_tags (
  user_id,
  media_id,
  tag_id,
  created_at
)
select
  user_id,
  movie_id,
  tag_id,
  created_at
from public.user_movie_tags
on conflict (user_id, media_id, tag_id) do update
set created_at = excluded.created_at;

do $$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from public.movies m
  left join public.media_items mi on mi.id = m.id and mi.type = 'movie'
  where mi.id is null;

  if v_count <> 0 then
    raise exception 'Movie media backfill missing % media_items rows.', v_count;
  end if;

  select count(*)
  into v_count
  from public.user_movies um
  left join public.user_media u
    on u.id = um.id
    and u.user_id = um.user_id
    and u.media_id = um.movie_id
    and u.status = case when um.status = 'to_watch' then 'wishlist' else um.status end
  where u.id is null;

  if v_count <> 0 then
    raise exception 'Movie media backfill missing or mismatched % user_media rows.', v_count;
  end if;

  select count(*)
  into v_count
  from public.user_movie_tags umt
  left join public.user_media_tags umat
    on umat.user_id = umt.user_id
    and umat.media_id = umt.movie_id
    and umat.tag_id = umt.tag_id
  where umat.tag_id is null;

  if v_count <> 0 then
    raise exception 'Movie media backfill missing or mismatched % user_media_tags rows.', v_count;
  end if;

  select count(*)
  into v_count
  from public.movies m
  left join public.media_provider_mappings mpm
    on mpm.media_id = m.id
    and mpm.provider = 'tmdb'
    and mpm.provider_media_type = 'movie'
    and mpm.provider_id = m.tmdb_id::text
  where mpm.media_id is null;

  if v_count <> 0 then
    raise exception 'Movie media backfill missing or mismatched % TMDB provider mappings.', v_count;
  end if;
end $$;
