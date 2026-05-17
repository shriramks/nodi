-- Keep library paging on the same indexed database path the UI actually uses.

create index user_movies_user_status_watchlisted_idx
  on public.user_movies (user_id, status, watchlisted_at desc nulls last);

create or replace function public.list_library_movies_page(
  p_status text,
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
      m.title as sort_title,
      jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'poster_path', m.poster_path
      ) as movie
    from public.user_movies um
    join public.movies m on m.id = um.movie_id
    where um.user_id = auth.uid()
      and um.status = p_status
      and (p_genre is null or m.primary_genre_name ilike p_genre)
      and (p_language is null or m.original_language = lower(p_language))
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
            from public.watch_logs wl
            where wl.user_id = um.user_id
              and wl.movie_id = um.movie_id
              and wl.watched_at >= p_watched_start
              and wl.watched_at < p_watched_end
          )
        )
      )
      and (
        not exists (select 1 from requested_tags)
        or exists (
          select 1
          from public.user_movie_tags umt
          join public.tags t
            on t.id = umt.tag_id
           and t.user_id = umt.user_id
          where umt.user_id = um.user_id
            and umt.movie_id = um.movie_id
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
    counted.movie_id,
    counted.status,
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
    counted.movie_id asc
  limit (select row_limit from query_options)
  offset (select row_offset from query_options);
$$;

grant execute on function public.list_library_movies_page(
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
