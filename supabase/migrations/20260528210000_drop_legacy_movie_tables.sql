-- Remove the legacy movie-only storage path after the media tables became authoritative.

do $$
declare
  v_count bigint;
begin
  if to_regclass('public.movies') is not null then
    select count(*)
    into v_count
    from public.movies m
    left join public.media_items mi
      on mi.id = m.id
      and mi.type = 'movie'
    where mi.id is null;

    if v_count <> 0 then
      raise exception 'Cannot drop legacy movies: % rows are missing movie media_items.', v_count;
    end if;
  end if;

  if to_regclass('public.provider_mappings') is not null then
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
    join public.media_items mi
      on mi.id = pm.movie_id
      and mi.type = 'movie'
    on conflict (provider, provider_media_type, provider_id) do update
    set
      media_id = excluded.media_id,
      episode_id = excluded.episode_id,
      created_at = excluded.created_at;
  end if;

  if to_regclass('public.user_movies') is not null then
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
    join public.media_items mi
      on mi.id = um.movie_id
      and mi.type = 'movie'
    on conflict (user_id, media_id) do update
    set
      status = excluded.status,
      personal_rating = excluded.personal_rating,
      added_at = excluded.added_at,
      watchlisted_at = excluded.watchlisted_at,
      last_watched_at = excluded.last_watched_at,
      completed_at = excluded.completed_at,
      completion_mode = excluded.completion_mode,
      updated_at = excluded.updated_at;
  end if;

  if to_regclass('public.user_movie_tags') is not null then
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
    join public.media_items mi
      on mi.id = umt.movie_id
      and mi.type = 'movie'
    on conflict (user_id, media_id, tag_id) do update
    set created_at = excluded.created_at;
  end if;

  if to_regclass('public.watch_logs') is not null then
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
  end if;

  if to_regclass('public.provider_mappings') is not null then
    select count(*)
    into v_count
    from public.provider_mappings pm
    left join public.media_provider_mappings mpm
      on mpm.media_id = pm.movie_id
      and mpm.provider = pm.provider
      and mpm.provider_media_type = 'movie'
      and mpm.provider_id = pm.provider_movie_id
    where mpm.media_id is null;

    if v_count <> 0 then
      raise exception 'Cannot drop legacy provider_mappings: % rows are missing media mappings.', v_count;
    end if;
  end if;

  if to_regclass('public.user_movies') is not null then
    select count(*)
    into v_count
    from public.user_movies um
    left join public.user_media umi
      on umi.user_id = um.user_id
      and umi.media_id = um.movie_id
      and umi.status = case um.status
        when 'watched' then 'done'
        when 'to_watch' then 'wishlist'
        else um.status
      end
    where umi.id is null;

    if v_count <> 0 then
      raise exception 'Cannot drop legacy user_movies: % rows are missing user_media rows.', v_count;
    end if;
  end if;

  if to_regclass('public.user_movie_tags') is not null then
    select count(*)
    into v_count
    from public.user_movie_tags umt
    left join public.user_media_tags umet
      on umet.user_id = umt.user_id
      and umet.media_id = umt.movie_id
      and umet.tag_id = umt.tag_id
    where umet.user_id is null;

    if v_count <> 0 then
      raise exception 'Cannot drop legacy user_movie_tags: % rows are missing user_media_tags rows.', v_count;
    end if;
  end if;

  if to_regclass('public.watch_logs') is not null then
    select count(*)
    into v_count
    from public.watch_logs wl
    left join public.media_watch_activity mwa
      on mwa.id = wl.id
      or mwa.legacy_watch_log_id = wl.id
    where mwa.id is null;

    if v_count <> 0 then
      raise exception 'Cannot drop legacy watch_logs: % rows are missing media_watch_activity rows.', v_count;
    end if;
  end if;
end $$;

alter table if exists public.media_watch_activity
  drop constraint if exists media_watch_activity_legacy_watch_log_id_fkey;

alter table if exists public.media_watch_activity
  drop column if exists legacy_watch_log_id;

drop function if exists public.apply_movie_watch_state(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  numeric,
  boolean,
  text
);

drop function if exists public.list_library_movies_page(
  text,
  integer,
  integer,
  text,
  text,
  text,
  text,
  text[],
  text,
  numeric,
  timestamptz,
  timestamptz
);

drop trigger if exists sync_last_watched_at_after_watch_log_change on public.watch_logs;
drop function if exists public.sync_last_watched_at();

drop table if exists public.user_movie_tags;
drop table if exists public.watch_logs;
drop table if exists public.user_movies;
drop table if exists public.provider_mappings;
drop table if exists public.movie_cast;
drop table if exists public.movies;
