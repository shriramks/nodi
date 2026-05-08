-- RLS policies decide which rows authenticated users can access, but Postgres
-- table privileges are still required before those policies are evaluated.

grant usage on schema public to authenticated;

grant select on table public.movies to authenticated;
grant select on table public.movie_cast to authenticated;
grant select on table public.provider_mappings to authenticated;

grant select, insert, update, delete on table public.user_movies to authenticated;
grant select, insert, update, delete on table public.watch_logs to authenticated;
grant select, insert, update, delete on table public.tags to authenticated;
grant select, insert, update, delete on table public.user_movie_tags to authenticated;
grant select, insert, update, delete on table public.provider_connections to authenticated;

grant select on table public.sync_cursors to authenticated;
grant select on table public.sync_events to authenticated;
