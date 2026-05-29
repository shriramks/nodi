-- Trigger: recompute show completion state whenever media_watch_activity changes.
-- Replaces the client-side ShowCompletionRepair component that fired on every page load.
-- Now fires atomically at write time for all paths (app actions and Trakt sync alike).
--
-- Logic mirrors refreshShowMediaLastWatchedAt in lib/db/mutations/media.ts:
--   - manual completion (status='done', completion_mode='manual'): preserved, only last_watched_at updated
--   - auto-complete (all non-special aired episodes watched): status='done', completion_mode='auto_all_aired'
--   - otherwise: status='watching', completion_mode=null, completed_at=null

create or replace function public.sync_show_completion_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id          uuid;
  v_media_id         uuid;
  v_media_type       text;
  v_um               record;
  v_max_watched      timestamptz;
  v_aired_count      integer;
  v_watched_count    integer;
  v_is_complete      boolean;
  v_new_status       text;
  v_new_mode         text;
  v_new_completed_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_user_id  := old.user_id;
    v_media_id := old.media_id;
  else
    v_user_id  := new.user_id;
    v_media_id := new.media_id;
  end if;

  -- Only run for shows
  select type into v_media_type
  from public.media_items
  where id = v_media_id;

  if v_media_type is distinct from 'show' then
    return null;
  end if;

  -- Load the user_media row; skip if none exists
  select * into v_um
  from public.user_media
  where user_id = v_user_id and media_id = v_media_id;

  if not found then
    return null;
  end if;

  -- Latest watch timestamp for this user+show across all episodes
  select max(watched_at) into v_max_watched
  from public.media_watch_activity
  where user_id = v_user_id and media_id = v_media_id;

  -- Preserve manual completion; only keep last_watched_at current
  if v_um.status = 'done' and v_um.completion_mode = 'manual' then
    update public.user_media
    set last_watched_at = v_max_watched
    where user_id = v_user_id and media_id = v_media_id;
    return null;
  end if;

  -- Non-special episodes that have aired (season 0 = specials, excluded)
  select count(*) into v_aired_count
  from public.episodes
  where show_id = v_media_id
    and season_number != 0
    and (air_date is null or air_date <= current_date);

  -- Distinct watched aired non-special episodes for this user
  select count(distinct mwa.episode_id) into v_watched_count
  from public.media_watch_activity mwa
  join public.episodes e on e.id = mwa.episode_id
  where mwa.user_id = v_user_id
    and mwa.media_id = v_media_id
    and e.season_number != 0
    and (e.air_date is null or e.air_date <= current_date);

  v_is_complete := v_aired_count > 0 and v_watched_count >= v_aired_count;

  if v_is_complete then
    v_new_status       := 'done';
    v_new_mode         := 'auto_all_aired';
    -- Preserve an existing completed_at timestamp; fall back to the latest watch date
    v_new_completed_at := coalesce(v_um.completed_at, v_max_watched);
  else
    -- Not complete: clear any auto-completion state and move to watching.
    -- Mirrors TypeScript: wishlist/done(auto)/stopped/watching all become 'watching'
    -- when the show is not yet fully watched.
    v_new_status       := 'watching';
    v_new_mode         := null;
    v_new_completed_at := null;
  end if;

  update public.user_media
  set
    status          = v_new_status,
    completion_mode = v_new_mode,
    completed_at    = v_new_completed_at,
    last_watched_at = v_max_watched
  where user_id = v_user_id and media_id = v_media_id;

  return null;
end;
$$;

create trigger sync_show_completion_state_after_watch_activity_change
after insert or update or delete on public.media_watch_activity
for each row execute function public.sync_show_completion_state();
