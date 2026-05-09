-- Server-side app code uses the Supabase service role for metadata ingestion,
-- encrypted provider secrets, and sync reconciliation. RLS bypass alone is not
-- enough when table privileges are enforced by PostgREST.

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.movies to service_role;
grant select, insert, update, delete on table public.movie_cast to service_role;
grant select, insert, update, delete on table public.user_movies to service_role;
grant select, insert, update, delete on table public.watch_logs to service_role;
grant select, insert, update, delete on table public.tags to service_role;
grant select, insert, update, delete on table public.user_movie_tags to service_role;
grant select, insert, update, delete on table public.provider_connections to service_role;
grant select, insert, update, delete on table public.provider_connection_secrets to service_role;
grant select, insert, update, delete on table public.provider_mappings to service_role;
grant select, insert, update, delete on table public.sync_cursors to service_role;
grant select, insert, update, delete on table public.sync_events to service_role;
