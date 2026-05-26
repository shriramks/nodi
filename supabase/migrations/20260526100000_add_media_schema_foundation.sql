-- Add the shared media schema beside the existing movie-only tables.
-- Existing movie tables, RPCs, routes, and provider mappings remain the live app path.

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('movie', 'show')),
  title text not null,
  original_title text null,
  release_date date null,
  first_air_date date null,
  release_year integer generated always as (
    case
      when coalesce(release_date, first_air_date) is null then null
      else extract(year from coalesce(release_date, first_air_date))::integer
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
  studio text null,
  network text null,
  season_count integer null check (season_count is null or season_count >= 0),
  episode_count integer null check (episode_count is null or episode_count >= 0),
  metadata_updated_at timestamptz not null default now(),
  tmdb_enriched_at timestamptz null,
  created_at timestamptz not null default now()
);

create index media_items_type_release_date_desc_idx
  on public.media_items (type, coalesce(release_date, first_air_date) desc nulls last);

create index media_items_original_language_idx
  on public.media_items (original_language);

create index media_items_primary_genre_id_idx
  on public.media_items (primary_genre_id);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.media_items(id) on delete cascade,
  season_number integer not null check (season_number >= 0),
  episode_number integer not null check (episode_number > 0),
  title text not null,
  air_date date null,
  runtime_minutes integer null check (runtime_minutes is null or runtime_minutes > 0),
  overview text null,
  poster_path text null,
  still_path text null,
  metadata_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (show_id, season_number, episode_number)
);

create index episodes_show_season_episode_idx
  on public.episodes (show_id, season_number, episode_number);

create index episodes_show_air_date_idx
  on public.episodes (show_id, air_date desc nulls last);

create table public.user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media_items(id) on delete cascade,
  status text not null check (status in ('watching', 'watched', 'wishlist')),
  personal_rating numeric(3,1) null check (
    personal_rating is null or (personal_rating >= 0 and personal_rating <= 10)
  ),
  added_at timestamptz not null default now(),
  watchlisted_at timestamptz null,
  last_watched_at timestamptz null,
  completed_at timestamptz null,
  completion_mode text null check (completion_mode is null or completion_mode in ('manual', 'auto_all_aired')),
  updated_at timestamptz not null default now(),
  unique (user_id, media_id)
);

create index user_media_user_status_last_watched_idx
  on public.user_media (user_id, status, last_watched_at desc nulls last);

create index user_media_user_status_watchlisted_idx
  on public.user_media (user_id, status, watchlisted_at desc nulls last);

create index user_media_user_status_personal_rating_idx
  on public.user_media (user_id, status, personal_rating desc nulls last);

create table public.user_media_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media_items(id) on delete cascade,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id, tag_id),
  foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);

create index user_media_tags_user_tag_idx
  on public.user_media_tags (user_id, tag_id);

create table public.media_provider_mappings (
  media_id uuid null references public.media_items(id) on delete cascade,
  episode_id uuid null references public.episodes(id) on delete cascade,
  provider text not null check (provider in ('tmdb', 'trakt', 'imdb')),
  provider_media_type text not null check (provider_media_type in ('movie', 'show', 'episode')),
  provider_id text not null,
  created_at timestamptz not null default now(),
  primary key (provider, provider_media_type, provider_id),
  check (
    (
      media_id is not null
      and episode_id is null
      and provider_media_type in ('movie', 'show')
    )
    or (
      media_id is null
      and episode_id is not null
      and provider_media_type = 'episode'
    )
  )
);

create unique index media_provider_mappings_media_provider_unique
  on public.media_provider_mappings (media_id, provider)
  where media_id is not null;

create unique index media_provider_mappings_episode_provider_unique
  on public.media_provider_mappings (episode_id, provider)
  where episode_id is not null;

create trigger set_user_media_updated_at
before update on public.user_media
for each row
execute function public.set_updated_at();

alter table public.media_items enable row level security;
alter table public.episodes enable row level security;
alter table public.user_media enable row level security;
alter table public.user_media_tags enable row level security;
alter table public.media_provider_mappings enable row level security;

grant select on table public.media_items to authenticated;
grant select on table public.episodes to authenticated;
grant select on table public.media_provider_mappings to authenticated;

grant select, insert, update, delete on table public.user_media to authenticated;
grant select, insert, update, delete on table public.user_media_tags to authenticated;

grant select, insert, update, delete on table public.media_items to service_role;
grant select, insert, update, delete on table public.episodes to service_role;
grant select, insert, update, delete on table public.user_media to service_role;
grant select, insert, update, delete on table public.user_media_tags to service_role;
grant select, insert, update, delete on table public.media_provider_mappings to service_role;

create policy "media items are readable by authenticated users"
on public.media_items
for select
to authenticated
using (true);

create policy "episodes are readable by authenticated users"
on public.episodes
for select
to authenticated
using (true);

create policy "media provider mappings are readable by authenticated users"
on public.media_provider_mappings
for select
to authenticated
using (true);

create policy "user media are owned by the current user"
on public.user_media
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user media tags are owned by the current user"
on public.user_media_tags
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
