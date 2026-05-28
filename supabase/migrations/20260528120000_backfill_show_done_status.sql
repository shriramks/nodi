-- Backfill user_media rows where all non-special aired episodes are watched but status
-- is still 'watching'. Marks them 'done' with auto_all_aired completion mode.

update public.user_media um
set
  status = 'done',
  completed_at = coalesce(
    um.completed_at,
    (
      select max(mwa.watched_at)
      from public.media_watch_activity mwa
      where mwa.user_id = um.user_id
        and mwa.media_id = um.media_id
    )
  ),
  completion_mode = coalesce(um.completion_mode, 'auto_all_aired')
where um.status = 'watching'
  -- only shows, not movies
  and exists (
    select 1
    from public.media_items mi
    where mi.id = um.media_id
      and mi.type = 'show'
  )
  -- must have at least one watched episode
  and exists (
    select 1
    from public.media_watch_activity mwa
    where mwa.user_id = um.user_id
      and mwa.media_id = um.media_id
  )
  -- no unwatched non-special aired episodes remain
  and not exists (
    select 1
    from public.episodes e
    where e.show_id = um.media_id
      and e.season_number != 0
      and (e.air_date is null or e.air_date <= current_date)
      and not exists (
        select 1
        from public.media_watch_activity mwa
        where mwa.user_id = um.user_id
          and mwa.media_id = um.media_id
          and mwa.episode_id = e.id
      )
  );
