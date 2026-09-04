-- Restore the missing DEFAULT on shared-metadata id columns.
--
-- 20260526100000_add_media_schema_foundation.sql created these columns as
--   id uuid primary key default gen_random_uuid()
-- but in the shared (production) environment the DEFAULT on episodes.id was
-- lost. The PRIMARY KEY / NOT NULL are still in place, only the DEFAULT is
-- gone -- consistent with a manual table recreation or a restore that did not
-- carry column defaults.
--
-- ingestPreparedTmdbShow (lib/db/mutations/media.ts) and the Trakt episode
-- sync both omit id on insert and depend on this default, so ingesting a
-- newly-aired season fails with:
--   null value in column "id" of relation "episodes" violates not-null
--   constraint  (SQLSTATE 23502)
-- which is why a show that gains a new season could not pull its episodes.
--
-- Re-assert the default here. ALTER ... SET DEFAULT is a metadata-only change
-- and is a safe no-op where the default is already correct, so the sibling
-- shared-metadata tables the same ingest path writes without an explicit id
-- are re-asserted too, to avoid a follow-on failure if they drifted the same
-- way.

alter table public.episodes
  alter column id set default gen_random_uuid();

alter table public.media_items
  alter column id set default gen_random_uuid();

alter table public.media_provider_mappings
  alter column id set default gen_random_uuid();
