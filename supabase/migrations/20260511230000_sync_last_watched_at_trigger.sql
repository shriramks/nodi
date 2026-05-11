-- Trigger to keep user_movies.last_watched_at in sync whenever watch_logs changes.
-- Replaces the application-level resyncLastWatchedAt approach which is fragile
-- (silent no-ops, missed calls). The trigger fires on every insert/update/delete
-- to watch_logs and recomputes MAX(watched_at) for the affected user+movie.

create or replace function public.sync_last_watched_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_movie_id uuid;
  v_max_watched_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_user_id  := old.user_id;
    v_movie_id := old.movie_id;
  else
    v_user_id  := new.user_id;
    v_movie_id := new.movie_id;
  end if;

  select max(watched_at) into v_max_watched_at
  from public.watch_logs
  where user_id = v_user_id and movie_id = v_movie_id;

  update public.user_movies
  set last_watched_at = v_max_watched_at
  where user_id = v_user_id and movie_id = v_movie_id;

  return null;
end;
$$;

create trigger sync_last_watched_at_after_watch_log_change
after insert or update or delete on public.watch_logs
for each row execute function public.sync_last_watched_at();

-- Repair existing stale last_watched_at values.
update public.user_movies um
set last_watched_at = (
  select max(wl.watched_at)
  from public.watch_logs wl
  where wl.user_id = um.user_id and wl.movie_id = um.movie_id
)
where um.status = 'watched';
