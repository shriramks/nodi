# Nodi — Supabase

This document is the Supabase-specific implementation note for Nodi.
It complements [architecture.md](../docs/architecture.md) and keeps database setup,
migration workflow, and Supabase responsibilities in one place.

## 1. Purpose

Supabase is responsible for:
- auth
- Postgres storage
- row-level security
- canonical app state for user library, tags, and sync tracking

This document exists so Supabase setup does not get mixed into the broader app architecture file.

## 2. Initial Migration

The initial schema lives at:

`supabase/migrations/20260505220000_initial_schema.sql`

This migration is intended to be applied once when the Supabase project is ready.

It creates:
- `movies`
- `movie_cast`
- `user_movies`
- `watch_logs`
- `tags`
- `user_movie_tags`
- `provider_connections`
- `provider_connection_secrets`
- `provider_mappings`
- `sync_cursors`
- `sync_events`

It also adds:
- indexes for query paths used by library, stats, and sync
- helper triggers for `updated_at`
- tag normalization trigger logic
- row-level security policies for user-owned tables
- a service-role-only token secret reference table for provider OAuth credentials

## 3. How To Apply It

Typical flow:

1. Create the Supabase project.
2. Link the local repo to that project.
3. Run pending Supabase migrations.
4. Verify the tables, indexes, and RLS policies exist.

The important operational rule is:
- this file should not be manually re-run after it has already been recorded by Supabase migrations
- later schema changes should go into new migration files, not edits to the applied migration

## 4. Schema Ownership

### Shared metadata tables

These are app-readable shared tables:
- `movies`
- `movie_cast`
- `media_items`
- `episodes`
- `provider_mappings`
- `media_provider_mappings`

They support:
- TMDB metadata ingestion
- local movie detail hydration
- provider ID resolution during sync
- planned media and TV metadata reads alongside the existing movie path

Writes to these tables should happen through trusted server-side paths using privileged credentials.

### User-owned tables

These tables are scoped per authenticated user:
- `user_movies`
- `watch_logs`
- `media_watch_activity`
- `tags`
- `user_movie_tags`
- `user_media`
- `user_media_tags`
- `provider_connections`
- `sync_cursors`
- `sync_runs`
- `sync_item_failures`
- `sync_events`

These are protected with RLS policies based on `auth.uid()`.

### Server-only encrypted credentials

`provider_connection_secrets` stores app-encrypted provider credential ciphertext. It has RLS
enabled, no authenticated-user policies, and explicit grants only for `service_role`, so normal user
sessions cannot read ciphertext through the API. Decryption also requires the deployment-only
`PROVIDER_SECRETS_KEY`.

## 5. Migration Strategy

Keep migrations append-only.

Rules:
- use one new migration file per schema change
- do not rewrite a migration that has already been applied to a shared environment
- prefer small, focused migrations over large mixed changes
- include indexes, constraints, triggers, and policy updates in the same migration when they belong to the same feature

Recommended future migration categories:
- new product tables or columns
- performance indexes for library or stats queries
- RLS or policy refinements
- sync-related schema additions
- views or RPCs if stats queries become heavy
- seed or reference data only if the app starts owning those lookups locally

## 6. Expected Future Migrations

Likely follow-up migrations:
- add SQL views or RPC helpers for stats aggregation
- refine sync tables once Trakt push/pull behavior is implemented
- add optional favorites or richer user state fields
- add constraints or backfill logic discovered during app integration

If a change affects live data behavior, create a new migration even if the SQL looks small.

## 7. Later Sync Migrations

`supabase/migrations/20260509223000_stabilize_sync_runs.sql` adds `sync_runs` as durable lifecycle
state for provider sync jobs. `sync_events` remains the append-only queue/audit table, while
`sync_runs` owns active progress, cancellation, stale-run failure marking, and the one-active-run
constraint per user/provider.

`supabase/migrations/20260510120000_add_movie_tmdb_enrichment_marker.sql` adds
`movies.tmdb_enriched_at` and marks existing non-minimal metadata rows as already enriched. Trakt
pull can continue inserting minimal movie rows, while manual TMDB backfill and lazy detail-page
enrichment mark rows after TMDB details and credits are ingested.

`supabase/migrations/20260510143000_add_sync_item_failures.sql` adds `sync_item_failures` for
durable item-level retry context. Recoverable Trakt pull/list failures are written before related
phase checkpoints and list snapshots advance, while `sync_runs.summary` and `sync_events.payload`
keep compact capped samples for UI display.

`supabase/migrations/20260515120000_add_sync_run_item_progress.sql` adds item-level progress
fields to `sync_runs` so provider sync UIs can show counts such as `41/143 history items` while
retaining the existing coarse phase progress for the overall run.

`supabase/migrations/20260517230000_align_library_query_path.sql` adds the missing to-watch sort
index on `user_movies (user_id, status, watchlisted_at desc nulls last)` and moves paged library
reads into `list_library_movies_page(...)` so watched-date and tag filters execute in Postgres
instead of materializing intermediate movie-id sets in the app process.

`supabase/migrations/20260526100000_add_media_schema_foundation.sql` adds the additive media schema
foundation for planned TV support. `media_items`, `episodes`, `user_media`, `user_media_tags`, and
`media_provider_mappings` sit beside the current movie tables; existing `movies`, `user_movies`,
`watch_logs`, `user_movie_tags`, `provider_mappings`, and movie RPC/query paths remain unchanged
until later backfill and read-path migrations intentionally switch traffic.

`supabase/migrations/20260526110000_backfill_movie_media_tables.sql` backfills current movie data
into the additive media tables without changing live movie paths. It preserves existing movie UUIDs
as movie `media_items.id` values, maps `user_movies.status = 'to_watch'` to
`user_media.status = 'wishlist'`, copies movie tags to `user_media_tags`, and backfills movie
provider ids into `media_provider_mappings`. The migration raises exceptions if copied row counts
or key relationships do not match the legacy movie tables.

`supabase/migrations/20260526120000_add_media_watch_activity.sql` adds the generalized
`media_watch_activity` table beside existing `watch_logs`. It backfills current movie watch log
events using the movie `media_items.id`, keeps a `legacy_watch_log_id` link for parity checks, and
adds user/date plus media/date indexes for future media stats and detail reads. Current movie watch
flows still use `watch_logs` until later media mutations intentionally switch traffic.

`supabase/migrations/20260526130000_add_media_library_movies_page_rpc.sql` adds
`list_media_library_movies_page(...)`, a route-compatible paged movie library read backed by
`user_media`, `media_items`, `user_media_tags`, and `media_watch_activity`. It preserves the
existing `/movies`, `/to-watch`, and `/api/library/movies` payload shape while mapping
`user_media.status = 'wishlist'` back to the legacy `to_watch` route status.

`supabase/migrations/20260526150000_add_media_library_type_filter.sql` adds the
`p_type = all|movie|show` argument to the paged media library RPC used by `/library` and `/wishlist`.
The default keeps the combined media view, while `movie` and `show` narrow the same indexed paged
query without falling back to application-side filtering.

`supabase/migrations/20260527180000_fix_watching_status_in_library_rpc.sql` fixes
`list_media_library_movies_page` to include `user_media` rows with `status = 'watching'` alongside
`status = 'watched'` when the caller requests the watched library. Shows synced from Trakt that are
in progress (some episodes watched, not yet complete) receive `status = 'watching'`; the prior WHERE
clause excluded them entirely. The output maps `'watching'` → `'watched'` so the returned payload
stays compatible with the existing `MovieStatus` type. The companion code fix in
`lib/db/queries/media.ts` widens the same filter in `listMediaStateAnalyticsRowsForUser` and
`listMediaRatingAnalyticsRowsForUser` so stats show counts, genre/language breakdowns, and average
ratings include in-progress shows.

## 8. Operational Notes

Keep these server-side only:
- `SUPABASE_SECRET_KEY`

Provider credentials are user-owned:
- Trakt client id / client secret / access token / refresh token are encrypted per user by the
  Next.js server before storage.
- TMDB API Read Access Tokens are encrypted per user by the Next.js server before storage.
- `provider_connection_secrets` stores ciphertext only.
- Keep `PROVIDER_SECRETS_KEY` only in server/deployment secrets. Losing it makes stored provider
  credentials unrecoverable.

Client-safe env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Practical rule:
- user-facing reads and writes should run in user auth context
- metadata ingestion and scheduled sync should run through server-side privileged access
