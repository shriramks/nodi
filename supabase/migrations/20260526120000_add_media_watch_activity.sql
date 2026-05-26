-- Add generalized media watch activity beside existing movie watch logs.
-- Existing movie watch flows continue to read and write public.watch_logs.

create table public.media_watch_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media_items(id) on delete cascade,
  episode_id uuid null references public.episodes(id) on delete cascade,
  watched_at timestamptz not null,
  source text not null check (source in ('manual', 'trakt_sync', 'tmdb_sync', 'import')),
  provider_event_id text null,
  notes text null,
  legacy_watch_log_id uuid null unique references public.watch_logs(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index media_watch_activity_user_watched_at_desc_idx
  on public.media_watch_activity (user_id, watched_at desc);

create index media_watch_activity_media_watched_at_desc_idx
  on public.media_watch_activity (media_id, watched_at desc);

create unique index media_watch_activity_user_provider_event_unique
  on public.media_watch_activity (user_id, provider_event_id)
  where provider_event_id is not null;

alter table public.media_watch_activity enable row level security;

grant select, insert, update, delete on table public.media_watch_activity to authenticated;
grant select, insert, update, delete on table public.media_watch_activity to service_role;

create policy "media watch activity is owned by the current user"
on public.media_watch_activity
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
join public.media_items mi
  on mi.id = wl.movie_id
  and mi.type = 'movie'
on conflict (id) do update
set
  user_id = excluded.user_id,
  media_id = excluded.media_id,
  episode_id = excluded.episode_id,
  watched_at = excluded.watched_at,
  source = excluded.source,
  provider_event_id = excluded.provider_event_id,
  notes = excluded.notes,
  legacy_watch_log_id = excluded.legacy_watch_log_id,
  created_at = excluded.created_at;

do $$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from public.watch_logs wl
  left join public.media_watch_activity mwa
    on mwa.id = wl.id
    and mwa.legacy_watch_log_id = wl.id
    and mwa.user_id = wl.user_id
    and mwa.media_id = wl.movie_id
    and mwa.episode_id is null
    and mwa.watched_at = wl.watched_at
    and mwa.source = wl.source
  where mwa.id is null;

  if v_count <> 0 then
    raise exception 'Media watch activity backfill missing or mismatched % movie watch log rows.', v_count;
  end if;

  select count(*)
  into v_count
  from public.media_watch_activity mwa
  left join public.media_items mi
    on mi.id = mwa.media_id
    and mi.type = 'movie'
  where mwa.legacy_watch_log_id is not null
    and mi.id is null;

  if v_count <> 0 then
    raise exception 'Media watch activity backfill found % legacy rows without movie media items.', v_count;
  end if;
end $$;
