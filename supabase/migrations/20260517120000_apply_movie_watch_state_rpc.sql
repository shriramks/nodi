-- Collapse common watched-state writes into one transactional RPC call.

create or replace function public.apply_movie_watch_state(
  p_movie_id uuid,
  p_status text,
  p_watched_at timestamptz default null,
  p_source text default null,
  p_provider_event_id text default null,
  p_notes text default null,
  p_personal_rating numeric default null,
  p_has_personal_rating boolean default false,
  p_operation text default 'set_status'
)
returns table (
  user_movie jsonb,
  watch_log jsonb
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_user_movie public.user_movies;
  v_watch_log public.watch_logs;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_status not in ('watched', 'to_watch') then
    raise exception 'Unsupported movie watch status: %', p_status;
  end if;

  if p_operation not in ('set_status', 'add_watch_date') then
    raise exception 'Unsupported movie watch-state operation: %', p_operation;
  end if;

  if p_operation = 'add_watch_date' and p_status <> 'watched' then
    raise exception 'Repeat-watch operations require watched status.';
  end if;

  if p_status = 'watched' and p_watched_at is null then
    raise exception 'watched_at is required for watched status.';
  end if;

  if p_status = 'to_watch' and p_operation <> 'set_status' then
    raise exception 'Watchlist operations must use set_status.';
  end if;

  if p_status = 'watched' then
    insert into public.user_movies (
      user_id,
      movie_id,
      status,
      personal_rating,
      watchlisted_at,
      last_watched_at
    )
    values (
      v_user_id,
      p_movie_id,
      'watched',
      case when p_has_personal_rating then p_personal_rating else null end,
      null,
      p_watched_at
    )
    on conflict (user_id, movie_id) do update
    set
      status = 'watched',
      personal_rating = case
        when p_has_personal_rating then excluded.personal_rating
        else user_movies.personal_rating
      end,
      watchlisted_at = null,
      last_watched_at = excluded.last_watched_at
    returning * into v_user_movie;

    insert into public.watch_logs (
      user_id,
      movie_id,
      watched_at,
      source,
      provider_event_id,
      notes
    )
    values (
      v_user_id,
      p_movie_id,
      p_watched_at,
      coalesce(p_source, 'manual'),
      p_provider_event_id,
      p_notes
    )
    returning * into v_watch_log;

    -- The watch_logs trigger recomputes last_watched_at after the insert.
    select *
    into v_user_movie
    from public.user_movies
    where id = v_user_movie.id;

    if p_source is distinct from 'trakt_sync' then
      insert into public.sync_events (
        user_id,
        provider,
        direction,
        event_type,
        status,
        payload
      )
      values (
        v_user_id,
        'trakt',
        'push',
        case
          when p_operation = 'add_watch_date' then 'movie.add_watch_date'
          else 'movie.mark_watched'
        end,
        'pending',
        case
          when p_operation = 'add_watch_date' then jsonb_build_object(
            'movieId', p_movie_id,
            'userMovieId', v_user_movie.id,
            'watchLogId', v_watch_log.id,
            'watchedAt', p_watched_at
          )
          else jsonb_build_object(
            'movieId', p_movie_id,
            'userMovieId', v_user_movie.id,
            'watchLogId', v_watch_log.id,
            'watchedAt', p_watched_at,
            'personalRating', case
              when p_has_personal_rating then p_personal_rating
              else null
            end
          )
        end
      );
    end if;
  else
    insert into public.user_movies (
      user_id,
      movie_id,
      status,
      personal_rating,
      watchlisted_at,
      last_watched_at
    )
    values (
      v_user_id,
      p_movie_id,
      'to_watch',
      case when p_has_personal_rating then p_personal_rating else null end,
      v_now,
      null
    )
    on conflict (user_id, movie_id) do update
    set
      status = 'to_watch',
      personal_rating = case
        when p_has_personal_rating then excluded.personal_rating
        else user_movies.personal_rating
      end,
      watchlisted_at = excluded.watchlisted_at,
      last_watched_at = null
    returning * into v_user_movie;

    if p_source is distinct from 'trakt_sync' then
      insert into public.sync_events (
        user_id,
        provider,
        direction,
        event_type,
        status,
        payload
      )
      values (
        v_user_id,
        'trakt',
        'push',
        'movie.add_to_watchlist',
        'pending',
        jsonb_build_object(
          'movieId', p_movie_id,
          'userMovieId', v_user_movie.id,
          'watchlistedAt', coalesce(v_user_movie.watchlisted_at, v_now)
        )
      );
    end if;
  end if;

  return query
  select to_jsonb(v_user_movie), to_jsonb(v_watch_log);
end;
$$;

grant execute on function public.apply_movie_watch_state(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  numeric,
  boolean,
  text
) to authenticated;
