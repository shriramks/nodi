-- Replace the 'watched' show status with 'done' and add 'stopped'.
-- 'done'    = user closed the book on the show (all eps watched, or manual arc closure)
-- 'stopped' = user gave up and is no longer watching
-- Existing 'watched' rows are migrated to 'done'.

-- 1. Drop the existing check constraint on user_media.status
alter table public.user_media
  drop constraint if exists user_media_status_check;

-- 2. Migrate existing 'watched' rows to 'done'
update public.user_media
  set status = 'done'
  where status = 'watched';

-- 3. Re-add the constraint with the new allowed values
alter table public.user_media
  add constraint user_media_status_check
    check (status in ('watching', 'done', 'stopped', 'wishlist'));

-- 4. Update the library RPC to match 'done', 'stopped', 'watching' for the library view
--    and map 'done'/'stopped'/'watching' all to 'watched' in the output (client still expects
--    "watched" | "to_watch" from MovieStatus).
create or replace function public.list_media_library_movies_page(
  p_status text,
  p_type text default 'all',
  p_limit integer default 48,
  p_offset integer default 0,
  p_sort_key text default null,
  p_sort_direction text default 'desc',
  p_genre text default null,
  p_language text default null,
  p_tag_names text[] default null,
  p_rating_op text default null,
  p_rating_value numeric default null,
  p_watched_start timestamptz default null,
  p_watched_end timestamptz default null
)
returns table (
  id uuid,
  user_id uuid,
  movie_id uuid,
  status text,
  personal_rating numeric,
  added_at timestamptz,
  watchlisted_at timestamptz,
  last_watched_at timestamptz,
  updated_at timestamptz,
  movie jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with query_options as (
    select
      case
        when p_sort_key in ('watched_date', 'added_date', 'rating', 'title') then p_sort_key
        when p_status = 'to_watch' then 'added_date'
        else 'watched_date'
      end as sort_key,
      case
        when p_sort_direction in ('asc', 'desc') then p_sort_direction
        else 'desc'
      end as sort_direction,
      case
        when p_status = 'to_watch' then 'wishlist'
        else p_status
      end as media_status,
      case
        when p_type in ('movie', 'show') then p_type
        else 'all'
      end as media_type,
      greatest(least(coalesce(p_limit, 48), 100), 1) as row_limit,
      greatest(coalesce(p_offset, 0), 0) as row_offset
  ),
  requested_tags as (
    select distinct lower(regexp_replace(btrim(tag_name), '\s+', ' ', 'g')) as normalized_name
    from unnest(coalesce(p_tag_names, '{}'::text[])) as tag_name
    where btrim(tag_name) <> ''
  ),
  filtered as (
    select
      um.*,
      mi.title as sort_title,
      jsonb_build_object(
        'id', mi.id,
        'type', mi.type,
        'title', mi.title,
        'poster_path', mi.poster_path
      ) as movie
    from public.user_media um
    join public.media_items mi
      on mi.id = um.media_id
    cross join query_options
    where um.user_id = auth.uid()
      and (
        um.status = query_options.media_status
        or (query_options.media_status = 'watched' and um.status in ('done', 'stopped', 'watching'))
      )
      and (
        query_options.media_type = 'all'
        or mi.type = query_options.media_type
      )
      and (p_genre is null or mi.primary_genre_name ilike p_genre)
      and (p_language is null or mi.original_language = lower(p_language))
      and (
        p_rating_op is null
        or case p_rating_op
          when '>=' then um.personal_rating >= p_rating_value
          when '>' then um.personal_rating > p_rating_value
          when '=' then um.personal_rating = p_rating_value
          when '<' then um.personal_rating < p_rating_value
          when '<=' then um.personal_rating <= p_rating_value
          else false
        end
      )
      and (
        p_watched_start is null
        or (
          p_watched_end is not null
          and exists (
            select 1
            from public.media_watch_activity mwa
            where mwa.user_id = um.user_id
              and mwa.media_id = um.media_id
              and mwa.watched_at >= p_watched_start
              and mwa.watched_at < p_watched_end
          )
        )
      )
      and (
        not exists (select 1 from requested_tags)
        or exists (
          select 1
          from public.user_media_tags umat
          join public.tags t
            on t.id = umat.tag_id
           and t.user_id = umat.user_id
          where umat.user_id = um.user_id
            and umat.media_id = um.media_id
            and t.normalized_name in (select normalized_name from requested_tags)
        )
      )
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id,
    counted.user_id,
    counted.media_id as movie_id,
    case
      when counted.status = 'wishlist' then 'to_watch'
      else 'watched'
    end as status,
    counted.personal_rating,
    counted.added_at,
    counted.watchlisted_at,
    counted.last_watched_at,
    counted.updated_at,
    counted.movie,
    counted.total_count
  from counted
  cross join query_options
  order by
    case
      when query_options.sort_key = 'title'
       and query_options.sort_direction = 'asc'
      then counted.sort_title
    end asc nulls last,
    case
      when query_options.sort_key = 'title'
       and query_options.sort_direction = 'desc'
      then counted.sort_title
    end desc nulls last,
    case
      when query_options.sort_key = 'rating'
       and query_options.sort_direction = 'asc'
      then counted.personal_rating
    end asc nulls last,
    case
      when query_options.sort_key = 'rating'
       and query_options.sort_direction = 'desc'
      then counted.personal_rating
    end desc nulls last,
    case
      when query_options.sort_key = 'added_date'
       and query_options.sort_direction = 'asc'
      then counted.watchlisted_at
    end asc nulls last,
    case
      when query_options.sort_key = 'added_date'
       and query_options.sort_direction = 'desc'
      then counted.watchlisted_at
    end desc nulls last,
    case
      when query_options.sort_key = 'watched_date'
       and query_options.sort_direction = 'asc'
      then counted.last_watched_at
    end asc nulls last,
    case
      when query_options.sort_key = 'watched_date'
       and query_options.sort_direction = 'desc'
      then counted.last_watched_at
    end desc nulls last,
    counted.media_id asc
  limit (select row_limit from query_options)
  offset (select row_offset from query_options);
$$;

grant execute on function public.list_media_library_movies_page(
  text,
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
) to authenticated;
