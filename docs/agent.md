# Nodi — Agent Instructions

## Primary rule

Start from `docs/agent.md` and local memory before doing anything substantial in this repo.

When making changes, giving recommendations, or answering repo-specific questions, use this order:
- `docs/agent.md` for repo operating rules
- `docs/product.md` for product scope and behavior
- `docs/architecture.md` for system boundaries and request flow
- `supabase/db_guide.md` plus `supabase/migrations/` for database and migration rules
- `docs/design.md` for UI direction and interaction tone

If one of those documents conflicts with older assumptions, follow the Nodi docs above instead of
generic habits from other projects.

## Product invariants

These are not optional implementation details. Preserve them unless the user explicitly changes the
product direction.

- Nodi is a mobile-first movie tracking PWA.
- Supabase is the source of truth for app state.
- TMDB is the primary metadata and search provider.
- Trakt is the sync peer for watched history, watchlist, and ratings.
- IMDb is a reference identifier, not a first-class sync provider in v1.
- Shared movie metadata and per-user movie state must stay split.
- Watch history must stay event-based in `watch_logs`; do not collapse it into a single boolean.
- Search is remote-first, but selected results should be ingested into local storage before detail use.
- Explicit watched dates matter for stats and sync correctness.
- The app is multi-user from day one, so auth and RLS are first-class concerns.

## Working approach

- Read `docs/agent.md` first, then open only the docs and files needed for the task.
- Read `progress_nodi.md` for current local task state before starting assigned work.
- After completing any unit of work, append an entry to `progress_nodi.md`. Format rules:
  - Every entry (`Todo` and `Done`) has a globally sequential number, oldest `Done` = `#1`, ascending
    by date. New entries continue the sequence.
  - Heading format: `### N — YYYY-MM-DD — Title` for `Done` or `### N — Title` for `Todo`.
  - `Done` entries are ordered oldest-first under `## Done`. `Todo` entries sit above `## Done` under
    `## Todo`.
  - Each entry has a `Files:` line listing changed files, then 2-4 terse bullets on what changed and
    why.
  - When planning a multi-session task, add all sessions as numbered `Todo` entries first. When a
    session is completed, move it to `Done` and renumber if needed to stay sequential, then append the
    files and bullets.
  - "Local progress log", "update progress", or similar phrases always refer to `progress_nodi.md`;
    do not grep for it.
- `progress_nodi.md` is the repo-specific local progress file name. Keep that name instead of a
  generic `progress.md` so local task history stays unambiguous when working across multiple repos.
- `progress_nodi.md` is local-only and ignored by Git. Update it for local task tracking, but do not
  mention that it is untracked/ignored in routine summaries, and never stage, force-add, commit, or
  push it.
- Use targeted lookup with `rg`/`rg --files`; avoid broad file sweeps unless the task actually needs it.
- Do not start routine changes by scanning the whole repo. Use the lookup map below first, then search
  narrowly inside the relevant directory or feature surface.
- Consult first before coding. State the intended approach, key assumptions, and likely files to change, then wait for confirmation before implementing.
- Do not use `git log` or historical archaeology unless the task specifically requires history.
- Never override ignore rules and never force-add ignored files.
- Keep secrets, tokens, local exports, imported watch-history files, and database dumps out of Git. Use `.local/` or `tmp/` for private working data.
- Treat the worktree as user-owned; do not revert unrelated changes.
- For substantial UI exploration, use local mockups inside the `mocks/` folder only — never place mock files in the repo root or elsewhere. Generated UI previews shown during repo work count as mockups: copy them into `mocks/` before presenting or referencing them. The `mocks/` folder is gitignored and must never be committed.
- Before changing schema behavior, check `supabase/db_guide.md` and the existing migration files first.
- Schema changes must be additive through new files in `supabase/migrations/`; do not rewrite an applied migration.
- Supabase migrations for this project are applied manually through the Supabase SQL Editor. Whenever
  a task adds a migration file, explicitly tell the user which migration SQL to run in the Supabase
  SQL Editor before considering the database change applied.

## Fast lookup map

Use this map before reaching for broad search. If the user asks for a change in one of these areas,
start with the listed files and only expand outward if those files point elsewhere.

| Task area | Start here | Then check |
| --- | --- | --- |
| App shell, protected routes, global layout | `app/(shell)/layout.tsx`, `components/navigation/` | `app/globals.css`, `components/settings/settings-sheet.tsx` |
| Auth and session behavior | `lib/auth/server.ts`, `lib/auth/paths.ts` | `app/auth/`, `components/auth/`, `lib/supabase/` |
| Supabase clients and env wiring | `lib/supabase/server.ts`, `lib/supabase/client.ts` | `lib/env/`, `.env.example` |
| Database schema, RLS, grants | `supabase/db_guide.md`, `supabase/migrations/` | `lib/db/types.ts` |
| DB validation | `lib/db/validation.ts` | calling mutation or route handler |
| Movie read queries and stats basics | `lib/db/queries/movies.ts` | `lib/db/queries/tags.ts`, `lib/db/queries/sync.ts` |
| Movie write mutations | `lib/db/mutations/movies.ts` | `lib/db/mutations/tags.ts`, `lib/db/mutations/sync.ts` |
| Tags | `lib/db/mutations/tags.ts`, `lib/db/queries/tags.ts` | movie detail client/page files |
| Sync events and provider connection state | `lib/db/mutations/sync.ts`, `lib/db/queries/sync.ts` | `supabase/migrations/`, future `app/api/sync/` routes |
| TMDB provider logic | `lib/providers/tmdb/client.ts`, `lib/providers/tmdb/adapters.ts` | search/detail routes that call them |
| TMDB images | `lib/providers/tmdb/images.ts` | components rendering TMDB images |
| Search UI and API | `components/search/movie-search.tsx`, `app/(shell)/search/page.tsx` | `app/api/search/movies/route.ts`, TMDB adapter/client |
| Remote TMDB detail before ingestion | `app/(shell)/movie/tmdb/[tmdbId]/page.tsx` | `app/(shell)/movie/tmdb/[tmdbId]/tmdb-movie-detail-client.tsx`, `app/(shell)/movie/actions.ts` |
| Local movie detail | `app/(shell)/movie/[movieId]/page.tsx` | `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `components/movie/movie-detail-view.tsx`, `app/(shell)/movie/[movieId]/actions.ts` |
| Shared detail presentation | `components/ui/detail.tsx`, `components/movie/movie-detail-view.tsx` | `components/movie/overview-text.tsx`, `components/media/credit-poster-card.tsx` |
| TMDB person detail | `app/(shell)/person/tmdb/[personId]/page.tsx` | `components/person/person-detail-view.tsx`, `components/media/credit-poster-card.tsx`, `components/ui/detail.tsx` |
| Watched Movies page | `app/(shell)/movies/page.tsx` | `components/movie/movie-library-grid.tsx`, `components/movie/poster-card.tsx` |
| To Watch page | `app/(shell)/to-watch/page.tsx` | `components/movie/poster-card.tsx` |
| Poster grid/card behavior | `components/movie/poster-card.tsx`, `components/movie/movie-library-grid.tsx` | `components/search/movie-search.tsx` if search posters are involved |
| Stats page | `app/(shell)/stats/page.tsx` | `lib/db/queries/movies.ts` |
| PWA manifest and icons | `app/manifest.ts`, `public/` | `app/layout.tsx` |
| Design decisions | `docs/design.md` | the component being changed |
| Product or architecture questions | `docs/product.md`, `docs/architecture.md` | `supabase/db_guide.md` for DB-specific questions |
| Progress tracking | `progress_nodi.md` | do not grep for it |

## Feature code map

Use this section for common repo questions before scanning. The goal is to start from the known owner
files, then inspect only direct imports, direct callers, or the relevant route boundary.

### Movies library

- Watched movies route: `app/(shell)/movies/page.tsx`
  - Loads watched user movies with `listLibraryMoviesPage({ status: "watched" })`.
  - Loads the lightweight watched summary with `getWatchedLibrarySummary()` for header and filter options.
  - Loads `listTags()` because the watched filter sheet renders tag options immediately.
  - Renders `MovieLibraryGrid`.
- To Watch route: `app/(shell)/to-watch/page.tsx`
  - Loads queued movies with `listLibraryMoviesPage({ status: "to_watch" })`.
  - Defers `listTags()` until the user opens the bulk tag sheet.
  - Reuses `MovieLibraryGrid` with `pageStatus="to_watch"`.
- Grid UI, sorting, local filter sheet, grouping, selection: `components/movie/movie-library-grid.tsx`
  - Client component.
  - Sorts watched by watched date, rating, or title.
  - Sorts to-watch by added date or title.
  - Watched filters are URL-backed and applied by the server query.
  - Filter sheet exposes genre, language, watched year/month, tags, and rating.
  - Sort-sheet selection and direction are explicit; filter-sheet draft changes use explicit clear/apply actions.
  - Sort/Filter toolbar uses 44px icon+label pills; the active-filter reset action is a separate 44x44 icon button.
  - Watched date filters intentionally stop at year/month granularity.
  - Groups by month/year label when sorting by watched or added date.
- Poster card navigation/selection: `components/movie/poster-card.tsx`
- Bulk actions from a grid selection: `components/movie/bulk-actions-bar.tsx`

### Movie read data

- Library query owner: `lib/db/queries/movies.ts`
  - `listLibraryMoviesPage()` joins `user_movies` to a minimal `movies` projection for grids.
  - Paged library grid reads execute through the `list_library_movies_page(...)` RPC so watched-date
    and tag filters stay in Postgres instead of intersecting movie-id sets in application memory.
  - `listUserMovies()` joins `user_movies` to full `movies` rows without hydrating tags.
  - Both read helpers accept status, limit, offset, and watched-library filters.
  - Genre/language/rating filters apply directly to `user_movies`/`movies`.
  - The full-row `listUserMovies()` helper still resolves tag and watched year/month filters through
    movie-id prefilters; the paged grid path does not.
  - Month filter keys are `YYYY-MM`; year filter keys are `YYYY`; month takes precedence.
  - Watched date stays in a compact filter-sheet row and opens a date subview so rating and tags remain near the top.
  - `getMovieDetail()` hydrates per-movie tags through `user_movie_tags` for tag-aware detail screens.
  - If a route-level library filter is needed, this is the server query to extend.
- Shared movie/user/tag types: `lib/db/types.ts`
  - `LibraryMovie` is the shape passed to `MovieLibraryGrid`.
  - `Movie` includes `primary_genre_name`, `original_language`, `release_year`, and poster metadata.
- Tags query owner: `lib/db/queries/tags.ts`

### Stats

- Stats route: `app/(shell)/stats/page.tsx`
  - Reads optional `tag` and `year` search params for stats-level filtering.
  - Loads `getLibraryStats(tagFilter, yearFilter)` and `listTags()`.
  - Renders hero metrics, `MoviesOverTime`, genre breakdown, rating distribution, language breakdown, and tag breakdown.
  - Genre and language visual components currently live in this file.
  - Genre and language breakdown items link to `/movies` with matching filters, the active watched year if present, and `from=stats`.
- Time chart: `app/(shell)/stats/movies-over-time.tsx`
  - Client component.
  - Toggles month/year view internally for all-time stats.
  - When stats are filtered to one watched year, renders month buckets for that year only and hides the month/year toggle.
  - Consumes `LibraryStatsTimeBucket[]` for month and year buckets.
  - Buckets have `key`, `label`, `count`, and `runtimeMinutes`.
  - Non-empty month/year bars link to `/movies` with `month` or `year` filters.
- Stats tag selector: `app/(shell)/stats/stats-tag-filter.tsx`
  - Client component.
  - Renders tag and year selector pills.
  - Navigates to `/stats?tag=<tag name>`, `/stats?year=<YYYY>`, or both while preserving the other active filter.
- Stats query owner: `lib/db/queries/stats.ts`
  - Loads watch-log analytics rows, tag analytics rows, and rating rows.
  - Delegates all aggregation to `buildLibraryStats()`.
- Stats transforms: `lib/db/queries/stats-transforms.ts`
  - Builds watched movie summaries from watch-log rows.
  - Builds genre, language, tag, rating, month, and year stats.
  - `availableYearBuckets` is computed after tag filtering but before year filtering so the stats year selector remains populated.
  - Year-filtered stats use watched years from `watch_logs.watched_at`; month buckets are fixed to Jan-Dec for that selected year.
  - Month bucket keys are `YYYY-MM`.
  - Year bucket keys are `YYYY`.
  - Genre breakdown keys are lower-cased genre labels.
  - Language breakdown keys are lower-cased original language codes, labels use `Intl.DisplayNames`.

### Navigation and return paths

- Shell layout and bottom nav: `app/(shell)/layout.tsx`, `components/navigation/bottom-pill-nav.tsx`
  - Bottom nav includes `/movies`, `/to-watch`, `/stats`, and `/search`.
- Generic back button: `components/navigation/back-button.tsx`
  - Client component calling `router.back()`.
- Movie detail pages:
  - Local detail route: `app/(shell)/movie/[movieId]/page.tsx`
  - Local detail client: `app/(shell)/movie/[movieId]/movie-detail-client.tsx`
    - Renders the watched hero summary (`Watched · <date>` or `Watched xN · Last watched <date>`).
    - Owns the compact watch-history disclosure row, history bottom sheet, edit/delete controls,
      and explicit `Log rewatch` action.
  - Remote TMDB detail route: `app/(shell)/movie/tmdb/[tmdbId]/page.tsx`

### Database fields relevant to stats filters

- Movie metadata table: `supabase/migrations/20260505220000_initial_schema.sql`
  - `movies.primary_genre_name`
  - `movies.original_language`
  - `movies.release_year`
- User library table:
  - `user_movies.status`
  - `user_movies.last_watched_at`
  - `user_movies.personal_rating`
- Watch history table:
  - `watch_logs.movie_id`
  - `watch_logs.watched_at`
  - Stats month/year buckets are based on `watch_logs`, not just `user_movies.last_watched_at`.
- Watched/watchlist writes:
  - `apply_movie_watch_state(...)` is the transactional RPC for single-movie watched, watchlist,
    repeat-watch, and outbound Trakt sync-event bookkeeping.
- User tags:
  - `tags.name`
  - `user_movie_tags.movie_id`
  - `user_movie_tags.tag_id`

## Search discipline

- For routine changes, use path-specific search, for example `rg "sync_events" lib/db supabase`
  instead of `rg "sync_events" .`.
- Search the whole repo only when:
  - the lookup map has no relevant owner,
  - a symbol is called from unknown places and the change may affect callers,
  - the task is explicitly a refactor or audit,
  - docs and code disagree and the source of truth must be found.
- If a broad scan is necessary, state why in the working update and keep the query specific.
- Prefer reading the direct owner file first, then its imports/callers, over inventorying every file.

## Commit safety

- Stage files explicitly; do not use broad staging unless the staged list is reviewed right after.
- Before every commit, inspect `git diff --cached --name-status`.
- If staged files include secrets, env files, mockups, local exports, dumps, build output, or other scratch files, stop and unstage them.
- Do not force-add ignored files.
- If a local-only file is needed for the task, verify it is ignored with `git check-ignore -v <path>`.
- Treat `.env*`, `mocks.html`, `mocks/`, `.local/`, `tmp/`, `*.local.*`, and database dumps as never-commit files.

## Supabase rules

- Keep Supabase-specific changes in Supabase-specific files.
- Use separate migration files for each schema change.
- The initial migration is meant to be applied once when the Supabase project is ready.
- User-owned tables must keep RLS aligned to `auth.uid()`.
- Shared metadata tables may be readable to authenticated users, but privileged writes should stay server-side.
- If a feature changes database behavior, update the relevant Supabase doc when needed instead of hiding the rule in app code alone.

## API and data rules

- Keep provider secrets server-side only.
- Client routes should talk to app-owned API routes, not directly to provider APIs, unless there is a deliberate documented exception.
- Normalize TMDB and Trakt payloads into app-owned shapes before the UI depends on them.
- Merge remote metadata with local user state on the server when building search and detail responses.
- Protect local-first behavior: user actions should write to Supabase first, then sync outward.
- Favor additive reconciliation over destructive sync behavior.

## UI rules

- Treat `docs/design.md` as a specification to verify against, not background reading. For each UI
  element being added or changed, identify which section governs it and confirm the implementation
  matches before considering the work done.
- Preserve the app’s mobile-first posture; default thinking should optimize for phone widths first.
- Movies and To Watch should stay poster-first rather than drifting into generic table layouts.
- Movie detail should keep hero metadata compact, plot below, and cast presented visually.
- Search results should surface local state like watched or to-watch status when available.
- Sync and settings UI should make connection state, sync health, and last sync time visible.
- Avoid inventing finance-style color semantics, metric framing, or terminology; this app is about movies, viewing history, and personal tracking.

## Response rules for this repo

- When a task is repo-specific, anchor the answer to `docs/agent.md` and the Nodi docs instead of generic advice.
- If a requested change would break one of the product invariants above, call that out directly before implementing.
- When changing schema, mention the migration file and any affected Supabase documentation.
- When changing behavior, keep the relationship between `docs/product.md`, `docs/architecture.md`, and `supabase/db_guide.md` coherent.
- Default to discussion before implementation, even when the requested code change seems straightforward, unless the user explicitly asks for direct execution.
