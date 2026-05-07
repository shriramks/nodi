# Nodi — Architecture

This document holds the technical architecture for Nodi. `blueprint.md` is the product document.
This file is for implementation boundaries, service responsibilities, API flow, and deployment shape.

## 1. High-Level Architecture

Nodi should use a simple three-layer model:

1. `Next.js` app on Vercel for UI, server routes, auth-aware actions, and cron-triggered jobs
2. `Supabase` for auth, Postgres storage, row-level security, and app-owned state
3. External movie providers:
   - `TMDB` for search and metadata
   - `Trakt` for watched/rating/watchlist sync

### System roles

**Client**
- renders PWA shell
- sends authenticated requests to app routes
- caches UI state and shell assets

**Next.js server routes**
- hide provider credentials
- normalize provider responses
- merge remote and local data
- perform write-safe server-side mutations

**Supabase**
- stores canonical app data
- enforces user-level access
- supports analytics queries and sync bookkeeping

**TMDB**
- title search
- movie details
- credits
- poster/backdrop metadata

**Trakt**
- watch history sync
- watchlist sync
- ratings sync

## 2. Why This Split Makes Sense

### TMDB for online search
Use TMDB for live movie search.

Reason:
- TMDB has a dedicated movie search endpoint: `GET /3/search/movie`
- TMDB supports a standard search -> details workflow
- TMDB has direct movie detail and credits endpoints
- TMDB metadata maps well to Nodi screens: title, release date, language, overview, poster, cast

Relevant official docs:
- TMDB search workflow: https://developer.themoviedb.org/docs/search-and-query-for-details
- TMDB movie search: https://developer.themoviedb.org/reference/search-movie
- TMDB movie details: https://developer.themoviedb.org/reference/movie-details
- TMDB movie credits: https://developer.themoviedb.org/reference/movie-credits

TMDB movie details also expose TMDB community rating fields such as `vote_average` and
`vote_count`, so TMDB rating can be shown in Movie Detail without additional provider complexity.

### Trakt for sync, not primary search
Trakt is better used as a sync peer for:
- watched history
- watchlist
- ratings

It should not be your primary online search layer because the app’s discovery and detail views need
consistent metadata and artwork coverage first.

### IMDb rating caveat
IMDb rating is possible, but not as frictionlessly as TMDB.

As of May 5, 2026, IMDb’s official API is provided through AWS Data Exchange and requires a
subscription / access workflow rather than a simple open consumer API. IMDb’s official docs show
GraphQL access for title ratings and search, but this is a separate integration surface and cost /
licensing decision.

Relevant official docs:
- IMDb API access: https://developer.imdb.com/documentation/api-documentation/getting-access/
- IMDb API overview: https://developer.imdb.com/documentation/api-documentation/
- IMDb sample title ratings query: https://developer.imdb.com/documentation/api-documentation/sample-queries/title-name

Recommendation:
- v1: show `your rating` + TMDB rating
- later: add IMDb rating only if you want to take on the AWS / licensing integration

## 3. Request Flow

### Search flow

```text
Client Search Input
  -> GET /api/search/movies?q=...
    -> Next.js route validates query
    -> Next.js route calls TMDB search
    -> Next.js route queries Supabase for matching tmdb_id rows
    -> Next.js route merges remote + local state
    -> returns normalized search results
```

### Detail hydration flow

```text
User taps search result
  -> GET /api/movies/tmdb/[tmdbId]
    -> fetch TMDB movie details
    -> fetch TMDB credits
    -> map payload to local schema
    -> upsert movies
    -> upsert movie_cast
    -> upsert provider_mappings
    -> return local movie id
  -> navigate to /movie/[localMovieId]
```

### Watch mutation flow

```text
User marks watched / changes rating / adds to watchlist
  -> write to Supabase immediately
  -> append sync_events row
  -> background push to Trakt
  -> update sync status
```

### Scheduled sync flow

```text
Vercel Cron
  -> /api/sync/trakt/pull
    -> load provider connection + cursors
    -> pull latest ratings/history/watchlist changes
    -> resolve provider ids
    -> upsert local rows
    -> update cursors
    -> log sync_events
```

## 4. Search Architecture

### Route contract

Use:

`GET /api/search/movies?q=<query>&page=<n>&language=<locale>`

This is your own app route, not a direct client-to-TMDB request.

### Why a server route is required

- provider secrets stay server-side
- you can debounce and rate-limit centrally
- you can merge TMDB results with local user state
- you can normalize the response shape so the client stays simple
- you can change providers later without rewriting the client

### Search route responsibilities

- validate `q`
- reject empty strings and extremely short noise
- trim and normalize whitespace
- call TMDB `GET /3/search/movie`
- optionally pass locale-aware `language`
- optionally pass `region` later if needed
- query local `movies` rows by `tmdb_id`
- join user state from `user_movies`
- return normalized merged results

### Recommended normalized response

```json
{
  "query": "perfect blue",
  "page": 1,
  "results": [
    {
      "tmdbId": 437,
      "localMovieId": "uuid-or-null",
      "title": "Perfect Blue",
      "originalTitle": "Perfect Blue",
      "releaseDate": "1997-02-28",
      "releaseYear": 1997,
      "originalLanguage": "ja",
      "posterPath": "/path.jpg",
      "overviewSnippet": "A pop singer's move into acting...",
      "genreIds": [16, 9648, 53],
      "alreadyInLibrary": true,
      "currentStatus": "watched",
      "personalRating": 8.5
    }
  ]
}
```

### Search UX behavior

- debounce input `250-350ms`
- do not query until 2-3 characters minimum
- cancel in-flight requests when query changes
- prefer server-side pagination
- show local-state badges in search results
- tapping a result should open the detail flow first

## 5. Detail Ingestion Architecture

When a user selects a remote result, Nodi should not keep working off the raw TMDB payload alone.
It should ingest the movie into local storage first.

### Fetch sequence

1. call TMDB movie details endpoint
2. call TMDB credits endpoint
3. transform remote payload into local schema
4. upsert `movies`
5. replace/upsert `movie_cast`
6. ensure `provider_mappings` contains `tmdb` and `imdb` references where available
7. create or update `user_movies` only when the user explicitly changes personal state

### Why ingest before detail render

- local detail pages get stable ids
- repeated visits are faster
- stats and filters work off local schema
- sync and tags do not depend on a live TMDB call every time

## 6. Database Boundaries

### App-owned data

Supabase owns:
- watch status
- watch logs
- personal ratings
- tags
- sync logs
- provider connections

### Provider-owned source data

TMDB and Trakt provide:
- metadata references
- upstream state to import or push

But neither should become the runtime source of truth for the app UI.

### Important schema rule

Split:
- `movies` for shared metadata
- `user_movies` for current per-user state
- `watch_logs` for history/events

That separation keeps stats accurate and sync manageable.

### Watched date requirement

Nodi needs explicit watched dates in `watch_logs` because:
- watched-over-time depends on real event dates
- monthly and yearly summaries depend on real event dates
- backfilled history must not collapse into a generic `watched=true` state

## 7. Security Model

### Secrets

Keep these server-side only:
- `TMDB_API_TOKEN`
- `TRAKT_CLIENT_ID`
- `TRAKT_CLIENT_SECRET`
- `SUPABASE_SECRET_KEY`

### Client-safe env vars

Only expose:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Access control

- user-facing reads and writes should use Supabase auth context
- metadata ingestion and sync jobs should use server-side privileged access
- RLS must protect all user-owned tables

### Multi-user scope

Nodi should support multiple users from day one, but only as a lightweight shared app model.

That means:
- every user owns their own `user_movies`, `watch_logs`, `tags`, and provider connections
- no admin dashboards or moderation tooling are required for v1
- auth and RLS still need to be treated as first-class because the product is not single-user

## 8. Deployment Shape

### Vercel

Use Vercel for:
- Next.js frontend
- route handlers
- cron-triggered sync routes

### Supabase

Use Supabase for:
- auth
- Postgres
- optional storage if you later cache user-uploaded assets

### PWA

Use:
- manifest
- installable app shell
- service worker for shell caching and basic offline resilience

For v1, online-first is fine. No offline mutation support is required.

## 9. Initial Route Map

### App routes

- `/movies`
- `/to-watch`
- `/stats`
- `/search`
- `/movie/[movieId]`
- `/settings`
- `/settings/sync`

### API routes

- `GET /api/search/movies`
- `GET /api/movies/tmdb/[tmdbId]`
- `POST /api/movies/[movieId]/status`
- `POST /api/movies/[movieId]/rating`
- `POST /api/movies/[movieId]/watched-date`
- `POST /api/movies/[movieId]/tags`
- `POST /api/sync/trakt/push`
- `POST /api/sync/trakt/pull`

## 10. Sync UI Requirements

The app should expose sync state in a dedicated settings area.

Minimum v1 requirements:
- connect / disconnect Trakt
- show provider connection state
- show last successful sync timestamp
- show current sync health: synced, pending, error
- allow manual sync retry

Recommended data sources:
- `provider_connections.status`
- latest successful `sync_events.processed_at`
- count of pending/error `sync_events`

## 11. Recommended v1 Technical Scope

Build v1 as:
- lightweight multi-user
- movie-only
- TMDB online search and metadata
- Supabase source of truth
- Trakt sync for watched/watchlist/ratings
- online-first PWA

That scope is large enough to be useful and still small enough to ship without overcomplicating the
data model or provider layer.
