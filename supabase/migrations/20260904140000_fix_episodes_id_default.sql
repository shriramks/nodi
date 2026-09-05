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
-- and is a safe no-op where the default is already correct.
--
-- media_provider_mappings is NOT included: it has no id column at all -- its
-- primary key is the composite (provider, provider_media_type, provider_id)
-- (see 20260526100000_add_media_schema_foundation.sql:107-114). It was never
-- part of this bug; an earlier version of this migration incorrectly assumed
-- it had a bare id column and was corrected after `alter table ...
-- media_provider_mappings alter column id ...` failed with 42703 (column
-- does not exist).

alter table public.episodes
  alter column id set default gen_random_uuid();

alter table public.media_items
  alter column id set default gen_random_uuid();
