-- Add server-side title search to the paged library RPC so /library and /wishlist search
-- runs as a scoped Postgres query instead of the client fetching every page and filtering
-- in memory. See docs/bugs.md for the diagnosis (search felt "local" but actually paged
-- through the whole library sequentially before it could match anything).

drop function if exists public.list_media_library_movies_page(
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
);

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
  p_watched_end timestamptz default null,
  p_search text default null
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
  search_query as (
    -- escape LIKE metacharacters so a literal '%' or '_' typed by the user
    -- is matched literally rather than acting as a wildcard
    select case
      when nullif(btrim(coalesce(p_search, '')), '') is null then null
      else replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_')
    end as query
  ),
  search_tokens as (
    select distinct lower(token) as token
    from search_query
    cross join lateral regexp_split_to_table(search_query.query, '\s+') as token
    where search_query.query is not null
      and btrim(token) <> ''
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
      ) as movie,
      case
        when search_query.query is null then null
        when mi.title ilike (search_query.query || '%') then 0
        when exists (
          select 1
          from regexp_split_to_table(mi.title, '[^a-zA-Z0-9]+') as w
          where w <> '' and w ilike (search_query.query || '%')
        ) then 1
        else 2
      end as search_rank
    from public.user_media um
    join public.media_items mi
      on mi.id = um.media_id
    cross join query_options
    cross join search_query
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
      and (
        not exists (select 1 from search_tokens)
        or not exists (
          select 1
          from search_tokens st
          where mi.title not ilike ('%' || st.token || '%')
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
    counted.search_rank asc nulls last,
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
  timestamptz,
  text
) to authenticated;
