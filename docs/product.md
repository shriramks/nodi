# Nodi — Product Blueprint

## 1. What You Are Building

Nodi is a mobile-first movie tracking PWA with four core tabs:
- `Movies`: watched movies in a 3-column poster grid
- `To Watch`: saved watchlist
- `Stats`: personal viewing analytics
- `Search`: find titles and add/update them

The app should feel personal and lightweight, but the data model cannot be lightweight in the wrong
places. If you want reliable stats plus sync, a movie needs:
- stable metadata
- user-specific state
- watch activity history

A single `watched: true/false` field is not enough.

## 2. Product Decisions I Recommend

### Canonical data model
Use **Supabase as the source of truth for app state** and treat external providers as sync peers.

Reason:
- the app needs custom tags, custom stats, and app-specific UX that external providers do not model
- you need the app to keep working even if one provider is disconnected
- periodic sync is safer when your database owns reconciliation

### Provider split
Use:
- **Trakt** for user-state sync: watched history, ratings, watchlist, and list imports as Nodi tags
- **TMDB** for metadata: posters, overview, release dates, primary genre, cast, search
- **IMDb** as a reference identifier only unless you explicitly want a later import/export track

Reasoning:
- TMDB officially supports search, movie details, credits, account watchlists, favourites, and ratings.
- Trakt is the stronger fit for personal watched-history style sync.
- IMDb does have consumer watchlist and watched features, but its official developer API is licensed
  through AWS and is not the right first choice for simple end-user periodic write-sync.

### Sync posture
Use **local-first with server-side reconciliation**:
- local user action updates Supabase immediately
- app attempts near-real-time outbound sync to connected providers
- scheduled jobs do pull + reconcile later

Reason:
- better UX than waiting for third-party APIs
- safer against provider downtime
- easier to support offline PWA actions later

## 3. Recommended Stack

- Framework: `Next.js` with App Router and TypeScript
- Styling: `Tailwind CSS`
- App shell / auth / DB: `Supabase`
- Deployment: `Vercel`
- PWA: manifest + service worker + offline shell caching
- Tests: `Vitest` for provider transforms, validation, analytics transforms, and mutation state
  helpers
- Background jobs:
  - `Vercel Cron` to trigger sync routes
  - Supabase tables for job state / cursors / logs

Detailed technical decisions live in [architecture.md](./architecture.md).

## 4. Code Structure

```text
app/
  (shell)/
    movies/page.tsx
    to-watch/page.tsx
    stats/page.tsx
    search/page.tsx
    movie/[movieId]/page.tsx
    movie/tmdb/[tmdbId]/page.tsx
    error.tsx
    not-found.tsx
    layout.tsx
  api/
    sync/trakt/push/route.ts
    sync/trakt/pull/route.ts
    sync/trakt/status/route.ts
    search/movies/route.ts
    movies/tmdb/[tmdbId]/route.ts
    providers/trakt/connect/route.ts
    providers/trakt/callback/route.ts
  layout.tsx
  manifest.ts

components/
  movie/
    poster-card.tsx
    movie-grid.tsx
    movie-detail-hero.tsx
    tag-editor-sheet.tsx
    watch-status-sheet.tsx
  stats/
    metric-card.tsx
    watch-time-chart.tsx
    genre-breakdown-chart.tsx
    language-breakdown-chart.tsx
  search/
    search-bar.tsx
    search-result-row.tsx
  navigation/
    bottom-pill-nav.tsx
  shared/
    empty-state.tsx
    loading-skeleton.tsx
    sheet.tsx
    chip.tsx

lib/
  supabase/
    client.ts
    server.ts
  auth/
  db/
    queries/
    mutations/
  providers/
    tmdb/
      client.ts
      adapters.ts
    trakt/
      client.ts
      adapters.ts
  sync/
    reconcile.ts
    conflict-resolution.ts
    cursors.ts
  stats/
    queries.ts
    transforms.ts
  validation/
    movie.ts
    tag.ts
  utils/

tests/
  db/
  providers/

supabase/
  db_guide.md
  migrations/
  seed.sql

public/
  icons/
  screenshots/

docs/
  agent.md
  product.md
  architecture.md
  design.md
  idea-pwa-icon.png
  sync.md
```

## 5. Data Model

### Core entities

`movies`
- canonical local movie row
- TMDB metadata cached here
- fields: `tmdb_id`, `imdb_id`, `title`, `release_date`, `primary_genre`, `original_language`,
  `overview`, `poster_path`, `runtime_minutes`

`movie_cast`
- cast members for movie detail

`user_movies`
- one row per user per movie
- fields:
  - `status`: `watched` or `to_watch`
  - `personal_rating`: decimal or int out of 10
  - `is_favorite`: optional later
  - `added_at`
  - `updated_at`
  - `watchlisted_at`
  - `last_watched_at`

`watch_logs`
- one row per watch event
- needed for:
  - watched over time
  - rewatches
  - total runtime watched
  - future streaks / diary style features

`tags`
- user-defined tags

`user_movie_tags`
- many-to-many join

`provider_connections`
- per-user OAuth/session metadata for Trakt and optional TMDB auth

`provider_connection_secrets`
- server-only app-encrypted provider credential ciphertext

`provider_mappings`
- stable external IDs per movie and provider

`sync_cursors`
- last pulled timestamps / checkpoints per provider and user

`sync_runs`
- active and historical provider sync run lifecycle state, including cancellation and stale-run
  recovery

`sync_item_failures`
- retryable item-level pull/list failures that must survive summary truncation and cursor movement

`sync_events`
- audit log of push/pull operations, failures, and conflicts

### Suggested Supabase schema

`public.movies`
- `id uuid primary key default gen_random_uuid()`
- `tmdb_id bigint unique not null`
- `imdb_id text unique null`
- `title text not null`
- `original_title text null`
- `release_date date null`
- `release_year int generated or derived in queries`
- `primary_genre_id int null`
- `primary_genre_name text null`
- `original_language text null`
- `overview text null`
- `poster_path text null`
- `backdrop_path text null`
- `runtime_minutes int null`
- `tmdb_vote_average numeric(3,1) null`
- `tmdb_vote_count int null`
- `popularity numeric null`
- `metadata_updated_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Indexes:
- unique index on `tmdb_id`
- unique partial index on `imdb_id where imdb_id is not null`
- index on `release_date desc`
- index on `original_language`
- index on `primary_genre_id`

`public.movie_cast`
- `id uuid primary key default gen_random_uuid()`
- `movie_id uuid not null references public.movies(id) on delete cascade`
- `tmdb_person_id bigint not null`
- `name text not null`
- `character_name text null`
- `profile_path text null`
- `cast_order int null`

Indexes:
- index on `(movie_id, cast_order)`
- unique index on `(movie_id, tmdb_person_id, character_name)`

`public.user_movies`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `movie_id uuid not null references public.movies(id) on delete cascade`
- `status text not null check (status in ('watched', 'to_watch'))`
- `personal_rating numeric(3,1) null`
- `added_at timestamptz not null default now()`
- `watchlisted_at timestamptz null`
- `last_watched_at timestamptz null`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `(user_id, movie_id)`
- index on `(user_id, status, last_watched_at desc)`
- index on `(user_id, status, personal_rating desc)`

`public.watch_logs`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `movie_id uuid not null references public.movies(id) on delete cascade`
- `watched_at timestamptz not null`
- `source text not null check (source in ('manual', 'trakt_sync', 'tmdb_sync', 'import'))`
- `provider_event_id text null`
- `notes text null`
- `created_at timestamptz not null default now()`

Indexes:
- index on `(user_id, watched_at desc)`
- index on `(user_id, movie_id, watched_at desc)`
- unique partial index on `(user_id, provider_event_id) where provider_event_id is not null`

`public.tags`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null`
- `normalized_name text not null`
- `created_at timestamptz not null default now()`

Indexes:
- unique index on `(user_id, normalized_name)`

`public.user_movie_tags`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `movie_id uuid not null references public.movies(id) on delete cascade`
- `tag_id uuid not null references public.tags(id) on delete cascade`
- `created_at timestamptz not null default now()`

Indexes:
- primary key on `(user_id, movie_id, tag_id)`
- index on `(user_id, tag_id)`

`public.provider_connections`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null check (provider in ('trakt', 'tmdb'))`
- `provider_user_id text null`
- `token_expires_at timestamptz null`
- `scopes text[] null`
- `status text not null default 'active' check (status in ('active', 'revoked', 'error'))`
- `last_validated_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `(user_id, provider)`

`public.provider_connection_secrets`
- `id uuid primary key default gen_random_uuid()`
- `connection_id uuid not null unique references public.provider_connections(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null check (provider in ('trakt', 'tmdb'))`
- `client_id_encrypted text null`
- `client_secret_encrypted text null`
- `api_token_encrypted text null`
- `access_token_encrypted text null`
- `refresh_token_encrypted text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Access:
- RLS enabled with no authenticated-user policies
- provider credential values are encrypted in the app with `PROVIDER_SECRETS_KEY`
- explicit table grants are limited to `service_role`

`public.provider_mappings`
- `movie_id uuid not null references public.movies(id) on delete cascade`
- `provider text not null check (provider in ('tmdb', 'trakt', 'imdb'))`
- `provider_movie_id text not null`
- `created_at timestamptz not null default now()`

Indexes:
- primary key on `(provider, provider_movie_id)`
- unique index on `(movie_id, provider)`

`public.sync_cursors`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null`
- `cursor_key text not null`
- `cursor_value text null`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `(user_id, provider, cursor_key)`

`public.sync_events`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null`
- `direction text not null check (direction in ('push', 'pull'))`
- `event_type text not null`
- `status text not null check (status in ('pending', 'success', 'error'))`
- `payload jsonb not null default '{}'::jsonb`
- `error_message text null`
- `created_at timestamptz not null default now()`
- `processed_at timestamptz null`

Indexes:
- index on `(user_id, provider, status, created_at desc)`
- index on `(user_id, created_at desc)`

`public.sync_runs`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null`
- `direction text not null check (direction in ('push', 'pull'))`
- `status text not null check (status in ('running', 'success', 'error', 'cancelled'))`
- progress fields: `phase`, `label`, `current`, `total`
- terminal fields: `summary`, `error_message`, `finished_at`, `cancelled_at`
- unique active-run index on `(user_id, provider) where status = 'running'`

`public.sync_item_failures`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `sync_run_id uuid null references public.sync_runs(id) on delete set null`
- `provider text not null`
- `direction text not null check (direction in ('push', 'pull'))`
- retry identity fields: `phase`, `item_key`, `retry_status`
- retry detail fields: `item_payload`, `error_message`, `attempt_count`, `first_failed_at`,
  `last_failed_at`, `resolved_at`
- unique pending identity on `(user_id, provider, direction, phase, item_key, retry_status)`

## 6. Why This Data Model Matters

### Watched status is not watch history
If a user marks a movie as watched, that tells you current state.
If a user watched the same movie twice, or wants accurate timeline stats, you need event rows.

So:
- `user_movies.status` answers "is this currently watched or on the watchlist?"
- `watch_logs` answers "when did the user watch it, and how many times?"

That split keeps the UI simple and the stats honest.

### Tags must be app-owned
Tags are part of Nodi's value. Even if provider sync exists, tags should remain a local feature and
never block the rest of the app.

### Row-level security
Every user-owned table should enforce `auth.uid() = user_id`.

RLS needed on:
- `user_movies`
- `watch_logs`
- `tags`
- `user_movie_tags`
- `provider_connections`
- `provider_connection_secrets`
- `sync_cursors`
- `sync_events`

`movies` and `movie_cast` can be readable to authenticated users, but writes should happen only
through server actions or route handlers using the Supabase secret key.

## 7. Sync Architecture

### Recommended v1

**Authoritative metadata**: TMDB

**Authoritative sync target for personal state**: Trakt

**Internal source of truth for UI and analytics**: Supabase

### Flows

#### Outbound
When user:
- marks watched
- changes rating
- adds/removes from To Watch

Then:
1. write to Supabase immediately
2. enqueue outbound sync event
3. push to Trakt
4. update sync status in `sync_events`

#### Inbound
On schedule:
1. pull latest Trakt history / ratings / watchlist deltas plus user lists
2. resolve movie IDs through local mapping and TMDB lookup if needed
3. upsert user state, watch logs, and list-derived tag links (all current list movies re-tagged on each full list fetch, idempotent)
4. store cursor

#### TMDB metadata backfill
Trakt-imported movies arrive as minimal rows without genre, language, poster, or runtime. The
backfill button in settings enriches all pending movies in batches of 50, looping automatically
until none remain. Genre and language stats are only meaningful after backfill completes.

### Conflict rule
For v1, keep it simple:
- local writes push immediately
- nightly pull imports missing upstream changes
- do not auto-delete local data on ambiguous conflicts
- prefer additive reconciliation over destructive reconciliation
- Trakt list removals do not automatically detach local tags; list snapshots only decide which remote
  additions should become new local tag links

Reason:
- users care more about not losing watch history than about perfect two-way deletes

## 8. App Flow Notes

### Movies
- default sort: recently watched desc
- sort options: recently watched, rating, title — each asc/desc; tap the selected option again to toggle direction
- sort by "recently watched" groups posters by month (e.g. "May 2026")
- sort by "rating" groups posters by rating value (9, 8, 7, … Unrated)
- sort by "title" renders a flat grid
- filter options: tags (multi-select, OR within tags) + rating (operator ≥ > = < ≤ + value stepper); tag + rating combined with AND; watched page only
- active sort (non-default) and active filter each show an indicator on the toolbar pill
- default presentation: poster-only watched grid
- grid density adapts to screen width via auto-fill minmax(96px, 1fr)
- tap card -> detail
- watched date is explicit and editable
- filters are URL-backed on `/movies` so direct navigation, clear, and stats drill-downs share the
  same behavior
- filter dimensions: genre, language, watched year, watched month, tag, and personal rating
- watched date filters stop at year/month granularity only; no day picker, calendar range, week, or
  custom date range
- month/year filters use `watch_logs.watched_at`; the grid still shows unique movie posters
- multi-select: "Select" button (top-right, header row) enters selection mode; Sort/Filter toolbar hides; tapping posters toggles selection; bulk bar offers Tag, Rate, and Unwatch (moves to watchlist)
- `UserMovieWithMovie` includes `tags: Tag[]` (fetched via parallel query in `listUserMovies`)

### To Watch
- same card pattern as Movies
- sort options: recently added, title — each asc/desc; no filter (no ratings, no tags to filter by)
- sort toolbar shows only Sort pill (no Filter pill)
- if marked watched, auto-remove from To Watch
- multi-select: same Select flow; bulk bar offers Tag, Rate, and Mark Watched

### Stats
- total watched
- total hours/minutes watched
- language breakdown
- tag breakdown
- movie count by tag
- watched over time
- genre breakdown
- monthly summary
- yearly summary
- genre, language, month, and year breakdown items link into `/movies` with the matching filters
- stats drill-down links include an explicit return path so the filtered Movies view can return to
  the originating Stats screen

These all become cleaner if runtime and watch logs are stored explicitly.

### Search
- use TMDB search first
- display title, year, poster, language
- if already in local DB, show current status inline
- tapping a search result opens detail first

### Movie detail presentation
- keep poster and compact metadata together in the hero area
- place plot below the hero block
- clamp long overviews with expand/collapse
- show cast as an image carousel, not a plain text-only list
- show sync state and last sync time

### Settings / sync
- provide a dedicated sync/settings area where users can:
  - connect Trakt
  - see current sync status
  - see last successful sync time
  - stop the active sync run
  - manually retry sync

## 9. Online Search Requirements

### What "online search" needs in practice
For Nodi, online search is not just a text box. It needs:
- remote title lookup
- local dedupe
- metadata caching
- provider ID mapping
- rate-limit-aware server calls

### Recommended search flow
1. User types query in Search tab.
2. Debounce input on client, around `250-350ms`.
3. Call your own server route, not TMDB directly from the client.
4. Server route queries TMDB `GET /3/search/movie`.
5. For each result, try to match an existing local `movies.tmdb_id`.
6. Return merged results:
   - remote metadata from TMDB
   - local status from `user_movies` if it already exists
   - local tags/rating summary if present
7. When the user taps an unsaved result:
   - fetch TMDB movie details plus credits using `GET /3/movie/{movie_id}` and
     `GET /3/movie/{movie_id}/credits`
   - render a read-only TMDB-backed detail page
   - do not write local rows yet
8. When the user explicitly marks watched, watchlists, rates, tags, or syncs the movie:
   - upsert into `movies`, `movie_cast`, and `provider_mappings`
   - create or update the user-owned row/event

### Why not search the local DB only
Because the app needs discovery outside the current library.
Local search is for Movies and To Watch filters. Search tab should be remote-first.

### What the search API route needs
`GET /api/tmdb/search?query=...`

Responsibilities:
- validate query length
- reject empty and very short noisy queries
- call TMDB with server-held token
- normalize fields into your internal shape
- merge with local rows by `tmdb_id`
- return a lightweight result list

Rationale:
- TMDB is the right online search source for Nodi because it has a dedicated movie search endpoint,
  clean movie detail and credits endpoints, and stable metadata coverage.
- Trakt should stay focused on watched-history/rating/watchlist sync and list imports as local tags,
  not primary live search.
- IMDb should remain an external ID reference unless you later decide to build a separate import flow.

Recommended result fields:
- `tmdbId`
- `title`
- `originalTitle`
- `releaseDate`
- `releaseYear`
- `posterPath`
- `overviewSnippet`
- `originalLanguage`
- `primaryGenreName`
- `alreadyInLibrary`
- `currentStatus`
- `personalRating`

### Caching strategy for search
- do not store every search query forever
- cache only selected movie metadata after click-through
- optionally short-cache raw search responses in memory or edge cache for a few minutes

### Online search dependencies
- TMDB API key / bearer token
- server route on Vercel
- local tables: `movies`, `movie_cast`, `provider_mappings`, `user_movies`
- image configuration for TMDB poster CDN

See [architecture.md](./architecture.md) for the concrete request flow,
route contracts, and service boundaries.

## 10. DB Setup Checklist

1. Create Supabase project.
2. Enable email auth or your preferred auth method.
3. Add all schema migrations for the tables above.
4. Enable RLS on every user-owned table.
5. Add policies scoped by `auth.uid()`.
6. Store Trakt and TMDB credentials in Supabase/Vercel env vars.
7. Add server-role-only write paths for metadata ingestion and sync jobs.
8. Add triggers for `updated_at` columns where needed.
9. Add SQL views or RPCs for stats queries if the client queries become heavy.
10. Seed genre and language support only if you need local lookup labels beyond TMDB payloads.

## 11. Questions To Finalize Before Building

Resolved:
1. explicit watched dates are required
2. marking watched auto-removes from `To Watch`
3. tags should support suggestions and autofill
4. tapping a search result opens detail first
5. sync UI should show connection state, sync status, and last sync time
6. stats should include monthly and yearly summaries
7. no offline support is required for v1
8. multi-user support is required, but without admin complexity

Still worth locking:
1. Do you want to support **rewatches** in v1, or is one watched event per movie enough initially?
2. Is rating optional, or should every watched movie encourage a rating?
3. Is scope intentionally **movies only**, with TV left out for now?

## 12. Build Plan

### Phase 1: Product lock
- confirm provider strategy
- confirm lightweight multi-user scope
- confirm watched-event and rewatch behavior
- confirm rating optionality and movies-only scope

### Phase 2: App foundation
- scaffold Next.js app
- set up Tailwind, Supabase auth, Supabase client wiring
- set up manifest, icons, installability, offline shell basics
- build bottom pill navigation and shell layout

### Phase 3: Database and server model
- create Supabase schema for movies, user_movies, watch_logs, tags, provider connections, sync logs
- add row-level security
- seed genre/language support as needed

### Phase 4: Metadata + search
- integrate TMDB search and movie detail fetch
- create local upsert pipeline for movie metadata
- build Search page and movie detail view

### Phase 5: Core library flows
- implement Movies grid
- implement To Watch grid
- implement detail editing for status, rating, tags
- implement watched-date editing
- implement sorting and filtering sheets

### Phase 6: Stats
- build aggregate queries
- build charts for watch timeline, genre, language, tags
- build monthly and yearly summary sections
- verify runtime-based total watch time

### Phase 7: Sync
- add Trakt OAuth / auth flow
- implement outbound push for watched, rating, watchlist changes
- implement scheduled inbound pull with cursors and reconciliation
- add sync health UI

### Phase 8: Polish and shipping
- refine loading, empty, and error states
- optimize poster loading and caching
- test install prompt, offline shell, and mobile layouts
- configure Vercel deployment and cron jobs

## 13. Practical Recommendation

If you want the cleanest first version, build this as:
- **movie-only**
- **lightweight multi-user**
- **Supabase source of truth**
- **TMDB metadata**
- **Trakt sync**
- **IMDb ID reference only**

That gives you the best chance of shipping a working v1 without painting the sync model into a corner.
