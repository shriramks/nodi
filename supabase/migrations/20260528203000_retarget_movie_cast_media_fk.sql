-- Retarget movie_cast to the shared media item row for movies.
-- Movie media rows keep the same UUID as the legacy movies row.

do $$
declare
  v_count bigint;
begin
  if to_regclass('public.movie_cast') is null then
    raise exception 'Cannot retarget movie_cast FK because public.movie_cast does not exist.';
  end if;

  if to_regclass('public.media_items') is null then
    raise exception 'Cannot retarget movie_cast FK because public.media_items does not exist.';
  end if;

  select count(*)
  into v_count
  from public.movie_cast mc
  left join public.media_items mi on mi.id = mc.movie_id and mi.type = 'movie'
  where mi.id is null;

  if v_count <> 0 then
    raise exception 'Cannot retarget movie_cast FK: % cast rows are missing movie media_items.', v_count;
  end if;
end $$;

alter table public.movie_cast
  drop constraint if exists movie_cast_movie_id_fkey;

alter table public.movie_cast
  add constraint movie_cast_movie_id_fkey
  foreign key (movie_id) references public.media_items(id) on delete cascade;
