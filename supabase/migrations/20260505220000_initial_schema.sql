-- Nodi initial Supabase schema.
-- This migration creates the core movie metadata, user library, tags, and sync tables.
-- Service-role writes are expected for metadata ingestion and sync jobs.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_tag_name()
returns trigger
language plpgsql
as $$
begin
  new.name = btrim(new.name);
  new.normalized_name = lower(regexp_replace(new.name, '\s+', ' ', 'g'));
  return new;
end;
$$;

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null unique,
  imdb_id text null,
  title text not null,
  original_title text null,
  release_date date null,
  release_year integer generated always as (
    case
      when release_date is null then null
      else extract(year from release_date)::integer
    end
  ) stored,
  primary_genre_id integer null,
  primary_genre_name text null,
  original_language text null,
  overview text null,
  poster_path text null,
  backdrop_path text null,
  runtime_minutes integer null check (runtime_minutes is null or runtime_minutes > 0),
  tmdb_vote_average numeric(3,1) null check (
    tmdb_vote_average is null or (tmdb_vote_average >= 0 and tmdb_vote_average <= 10)
  ),
  tmdb_vote_count integer null check (tmdb_vote_count is null or tmdb_vote_count >= 0),
  popularity numeric null,
  metadata_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index movies_imdb_id_unique
  on public.movies (imdb_id)
  where imdb_id is not null;

create index movies_release_date_desc_idx
  on public.movies (release_date desc nulls last);

create index movies_original_language_idx
  on public.movies (original_language);

create index movies_primary_genre_id_idx
  on public.movies (primary_genre_id);

create table public.movie_cast (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  tmdb_person_id bigint not null,
  name text not null,
  character_name text null,
  profile_path text null,
  cast_order integer null check (cast_order is null or cast_order >= 0)
);

create index movie_cast_movie_id_cast_order_idx
  on public.movie_cast (movie_id, cast_order);

create unique index movie_cast_movie_person_character_unique
  on public.movie_cast (movie_id, tmdb_person_id, coalesce(character_name, ''));

create table public.user_movies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  status text not null check (status in ('watched', 'to_watch')),
  personal_rating numeric(3,1) null check (
    personal_rating is null or (personal_rating >= 0 and personal_rating <= 10)
  ),
  added_at timestamptz not null default now(),
  watchlisted_at timestamptz null,
  last_watched_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (user_id, movie_id)
);

create index user_movies_user_status_last_watched_idx
  on public.user_movies (user_id, status, last_watched_at desc nulls last);

create index user_movies_user_status_personal_rating_idx
  on public.user_movies (user_id, status, personal_rating desc nulls last);

create table public.watch_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  watched_at timestamptz not null,
  source text not null check (source in ('manual', 'trakt_sync', 'tmdb_sync', 'import')),
  provider_event_id text null,
  notes text null,
  created_at timestamptz not null default now()
);

create index watch_logs_user_watched_at_desc_idx
  on public.watch_logs (user_id, watched_at desc);

create index watch_logs_user_movie_watched_at_desc_idx
  on public.watch_logs (user_id, movie_id, watched_at desc);

create unique index watch_logs_user_provider_event_unique
  on public.watch_logs (user_id, provider_event_id)
  where provider_event_id is not null;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index tags_user_normalized_name_unique
  on public.tags (user_id, normalized_name);

create table public.user_movie_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id, tag_id),
  foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);

create index user_movie_tags_user_tag_idx
  on public.user_movie_tags (user_id, tag_id);

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('trakt', 'tmdb')),
  provider_user_id text null,
  access_token text null,
  refresh_token text null,
  token_expires_at timestamptz null,
  scopes text[] null,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_validated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.provider_mappings (
  movie_id uuid not null references public.movies(id) on delete cascade,
  provider text not null check (provider in ('tmdb', 'trakt', 'imdb')),
  provider_movie_id text not null,
  created_at timestamptz not null default now(),
  primary key (provider, provider_movie_id),
  unique (movie_id, provider)
);

create table public.sync_cursors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('trakt', 'tmdb')),
  cursor_key text not null,
  cursor_value text null,
  updated_at timestamptz not null default now(),
  unique (user_id, provider, cursor_key)
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('trakt', 'tmdb')),
  direction text not null check (direction in ('push', 'pull')),
  event_type text not null,
  status text not null check (status in ('pending', 'success', 'error')),
  payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index sync_events_user_provider_status_created_idx
  on public.sync_events (user_id, provider, status, created_at desc);

create index sync_events_user_created_idx
  on public.sync_events (user_id, created_at desc);

create trigger set_user_movies_updated_at
before update on public.user_movies
for each row
execute function public.set_updated_at();

create trigger set_provider_connections_updated_at
before update on public.provider_connections
for each row
execute function public.set_updated_at();

create trigger set_sync_cursors_updated_at
before update on public.sync_cursors
for each row
execute function public.set_updated_at();

create trigger normalize_tags_before_write
before insert or update on public.tags
for each row
execute function public.normalize_tag_name();

alter table public.movies enable row level security;
alter table public.movie_cast enable row level security;
alter table public.user_movies enable row level security;
alter table public.watch_logs enable row level security;
alter table public.tags enable row level security;
alter table public.user_movie_tags enable row level security;
alter table public.provider_connections enable row level security;
alter table public.provider_mappings enable row level security;
alter table public.sync_cursors enable row level security;
alter table public.sync_events enable row level security;

create policy "movies are readable by authenticated users"
on public.movies
for select
to authenticated
using (true);

create policy "movie cast is readable by authenticated users"
on public.movie_cast
for select
to authenticated
using (true);

create policy "provider mappings are readable by authenticated users"
on public.provider_mappings
for select
to authenticated
using (true);

create policy "user movies are owned by the current user"
on public.user_movies
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "watch logs are owned by the current user"
on public.watch_logs
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tags are owned by the current user"
on public.tags
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user movie tags are owned by the current user"
on public.user_movie_tags
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "provider connections are readable and writable by the current user"
on public.provider_connections
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sync cursors are readable by the current user"
on public.sync_cursors
for select
to authenticated
using (auth.uid() = user_id);

create policy "sync events are readable by the current user"
on public.sync_events
for select
to authenticated
using (auth.uid() = user_id);
