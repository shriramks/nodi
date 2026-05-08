# Nodi — Supabase

This document is the Supabase-specific implementation note for Nodi.
It complements [architecture.md](/Users/shriramks/Projects/nodi/docs/architecture.md) and keeps database setup,
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
- `provider_mappings`

They support:
- TMDB metadata ingestion
- local movie detail hydration
- provider ID resolution during sync

Writes to these tables should happen through trusted server-side paths using privileged credentials.

### User-owned tables

These tables are scoped per authenticated user:
- `user_movies`
- `watch_logs`
- `tags`
- `user_movie_tags`
- `provider_connections`
- `sync_cursors`
- `sync_events`

These are protected with RLS policies based on `auth.uid()`.

### Server-only token references

`provider_connection_secrets` stores Vault secret ids for provider OAuth tokens. It has RLS enabled,
no authenticated-user policies, and explicit grants only for `service_role`, so normal user sessions
cannot read token references through the API.

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

## 7. Operational Notes

Keep these server-side only:
- `SUPABASE_SECRET_KEY`
- `TMDB_API_TOKEN`
- `TRAKT_CLIENT_ID`
- `TRAKT_CLIENT_SECRET`

Client-safe env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Practical rule:
- user-facing reads and writes should run in user auth context
- metadata ingestion and scheduled sync should run through server-side privileged access
