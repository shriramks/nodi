# Nodi — Agent Instructions

## Primary rule

Start from `AGENT.md` before doing anything substantial in this repo.

This repo has no separate memory store. Write any durable feedback, conventions, or pointers into
`AGENT.md` itself (or the doc it points to) — never into a `memory/` directory or other side file.
The `memory/` directory is not tracked and must stay empty.

When making changes, giving recommendations, or answering repo-specific questions, use this order:
- `AGENT.md` for repo operating rules
- `docs/product.md` for product scope and behavior
- `docs/architecture.md` for system boundaries and request flow
- `docs/data-flow.md` for E2E data flow: which tables are written and read per action
- `supabase/db_guide.md` plus `supabase/migrations/` for database and migration rules
- `docs/design.md` for UI direction and interaction tone
- `docs/bugs.md` when troubleshooting: known bugs, root causes, and diagnostic patterns

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
- Watch history must stay event-based in `media_watch_activity`; do not collapse it into a single boolean.
- Search is remote-first, but selected results should be ingested into local storage before detail use.
- Explicit watched dates matter for stats and sync correctness.
- The app is multi-user from day one, so auth and RLS are first-class concerns.

## Working approach

- Read `AGENT.md` first, then open only the docs and files needed for the task.
- Read `progress_nodi.md` for current local task state before starting assigned work.
- After completing any unit of work, update `progress_nodi.md`. Format rules:
  - `Done` entries are ordered newest-first under `## Done`; the latest completed work is always the
    first `Done` entry, never appended near the bottom.
  - `Done` numbers reflect that newest-first order: highest number at the top, descending by one down
    to oldest `Done` = `#1`. A new `Done` entry gets the previous top `Done` number + 1.
  - `Todo` entries sit above `## Done` under `## Todo` and use numbers higher than the current highest
    `Done` number.
  - Heading format: `### N — YYYY-MM-DD — Title` for `Done` or `### N — Title` for `Todo`.
  - Each entry has a `Files:` line listing changed files, then 2-4 terse bullets on what changed and
    why.
  - When planning a multi-session task, add all sessions as numbered `Todo` entries first. When a
    session is completed, move it to the top of `Done` and renumber if needed to preserve the
    newest-first sequence.
  - Before editing the log, inspect the full heading sequence from the top of the file; do not rely on
    `tail` or the last visible entry to determine the next number or insertion point.
  - After editing the log, validate that `Done` dates are newest-to-oldest, `Done` numbers descend
    without gaps or duplicates, `Todo` numbers are above the `Done` range, and there is only one
    `## Todo` and one `## Done` section.
  - "Local progress log", "update progress", or similar phrases always refer to `progress_nodi.md`;
    do not grep for it.
- `progress_nodi.md` is the repo-specific local progress file name. Keep that name instead of a
  generic `progress.md` so local task history stays unambiguous when working across multiple repos.
- `progress_nodi.md` is local-only and ignored by Git. Update it for local task tracking, but do not
  mention that it is untracked/ignored in routine summaries, and never stage, force-add, commit, or
  push it.
- Use the `Read` tool to read file contents; do not use `cat`, `head`, `tail`, `sed`, or `awk` for reading.
- Computed status values (`isShowDone`, completion state, etc.) must write back to the database — never override display only and leave Supabase stale.
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
| Movie/media read queries and stats | `lib/db/queries/media.ts` | `lib/db/queries/movies.ts` (legacy), `lib/db/queries/tags.ts`, `lib/db/queries/sync.ts` |
| Movie/media write mutations | `lib/db/mutations/media.ts` | `lib/db/mutations/movies.ts` (legacy), `lib/db/mutations/tags.ts`, `lib/db/mutations/sync.ts` |
| Show detail, episode mutations | `lib/db/mutations/media.ts`, `app/(shell)/show/actions.ts` | `lib/db/queries/media.ts`, `components/show/` |
| Tags | `lib/db/mutations/tags.ts`, `lib/db/queries/tags.ts` | `lib/db/mutations/media.ts` (media tag ops), movie/show detail client files |
| Sync events and provider connection state | `lib/db/mutations/sync.ts`, `lib/db/queries/sync.ts` | `supabase/migrations/`, future `app/api/sync/` routes |
| TMDB provider logic | `lib/providers/tmdb/client.ts`, `lib/providers/tmdb/adapters.ts` | search/detail routes that call them |
| TMDB images | `lib/providers/tmdb/images.ts` | components rendering TMDB images |
| Search UI and API | `components/search/movie-search.tsx`, `app/(shell)/search/page.tsx` | `app/api/search/movies/route.ts`, TMDB adapter/client |
| Remote TMDB detail before ingestion | `app/(shell)/movie/tmdb/[tmdbId]/page.tsx` | `app/(shell)/movie/tmdb/[tmdbId]/tmdb-movie-detail-client.tsx`, `app/(shell)/movie/actions.ts` |
| Local movie detail | `app/(shell)/movie/[movieId]/page.tsx` | `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `components/movie/movie-detail-view.tsx`, `app/(shell)/movie/[movieId]/actions.ts` |
| Shared detail presentation | `components/ui/detail.tsx`, `components/movie/movie-detail-view.tsx` | `components/movie/overview-text.tsx`, `components/media/credit-poster-card.tsx`, `components/media/cast-member-card.tsx`, `components/media/media-info-panel.tsx`, `components/media/detail-hero-section.tsx` |
| Shared media format utilities | `lib/media/format.ts` | components using `getTmdbRating`, `languageDisplayName`, `formatDate` |
| TMDB person detail | `app/(shell)/person/tmdb/[personId]/page.tsx` | `components/person/person-detail-view.tsx`, `components/media/credit-poster-card.tsx`, `components/ui/detail.tsx` |
| Library page | `app/(shell)/library/page.tsx` | `components/library/library-grid.tsx`, `components/movie/poster-card.tsx` |
| Wishlist page | `app/(shell)/wishlist/page.tsx` | `components/library/library-grid.tsx`, `components/movie/poster-card.tsx` |
| Route redirects (legacy) | `app/(shell)/movies/page.tsx` → `/library`, `app/(shell)/to-watch/page.tsx` → `/wishlist` | `app/(shell)/library/library-route.ts` |
| Poster grid/card behavior | `components/movie/poster-card.tsx`, `components/library/library-grid.tsx` | `components/search/movie-search.tsx` if search posters are involved |
| Stats page | `app/(shell)/stats/page.tsx` | `lib/db/queries/movies.ts` |
| PWA manifest and icons | `app/manifest.ts`, `public/` | `app/layout.tsx` |
| Design decisions | `docs/design.md` | the component being changed |
| Product or architecture questions | `docs/product.md`, `docs/architecture.md` | `supabase/db_guide.md` for DB-specific questions |
| Data flow, write/read path per action | `docs/data-flow.md` | `lib/db/mutations/`, `lib/db/queries/` |
| Troubleshooting / debugging | `docs/bugs.md` | query DB first, then read code |
| Progress tracking | `progress_nodi.md` | do not grep for it |

## Feature code map

Use this section for common repo questions before scanning. The goal is to start from the known owner
files, then inspect only direct imports, direct callers, or the relevant route boundary.

### Library

- Library route: `app/(shell)/library/page.tsx`
  - Loads watched media with `listMediaLibraryMoviesPage({ status: "watched", type })`.
  - Loads the lightweight watched summary with `getMediaWatchedMovieLibrarySummary()` for header and filter options.
  - Loads `listTags()` because the watched filter sheet renders tag options immediately.
  - Renders `LibraryGrid`.
  - `/movies` redirects here via `app/(shell)/movies/page.tsx`.
- Wishlist route: `app/(shell)/wishlist/page.tsx`
  - Loads queued media with `listMediaLibraryMoviesPage({ status: "to_watch", type })`.
  - Defers `listTags()` until the user opens the bulk tag sheet.
  - Reuses `LibraryGrid`.
  - `/to-watch` redirects here via `app/(shell)/to-watch/page.tsx`.
- Route params and filter parsing shared: `app/(shell)/library/library-route.ts`.
- Grid UI, sorting, local filter sheet, grouping, selection: `components/library/library-grid.tsx`
  - Client component.
  - Sorts watched by watched date, rating, or title.
  - Sorts to-watch by added date or title.
  - Watched filters are URL-backed and applied by the server query.
  - Filter sheet exposes genre, language, watched year/month, tags, and rating.
  - Sort-sheet selection and direction are explicit; filter-sheet draft changes use explicit clear/apply actions.
  - Type, Filter, and Sort use 44px icon+label pills; the active-filter reset action is a separate 44x44 icon button.
  - Select uses a separate 44x44 icon button with a circular check affordance.
  - Watched date filters intentionally stop at year/month granularity.
  - Groups by month/year label when sorting by watched or added date.
- Poster card navigation/selection: `components/movie/poster-card.tsx`
- Bulk actions from a grid selection: `components/movie/bulk-actions-bar.tsx`

### Movie and media read data

- Active library query owner: `lib/db/queries/media.ts`
  - `listMediaLibraryMoviesPage()` calls the `list_media_library_movies_page(...)` RPC, which supports
    both movie and show rows from `user_media` + `media_items`. This is the path the Library and
    Wishlist pages use.
  - `getMediaDetail()` loads a single `media_items` row plus `user_media`, `media_watch_activity`,
    `user_media_tags`, and `media_provider_mappings` for detail screens.
  - `getShowDetail()` wraps `getMediaDetail()` and appends episode + watch-activity data.
  - `getEpisodeDetail()` loads a single episode plus its show context.
  - `getMediaStatsInput()` loads analytics rows for stats.
- Shared types: `lib/db/types.ts`
  - `LibraryMovie` is the shape passed to `LibraryGrid`.
  - `MediaItem` is the shared show/movie metadata row.
- Tags query owner: `lib/db/queries/tags.ts`

### Stats

- Stats route: `app/(shell)/stats/page.tsx`
  - Reads optional `tag` and `year` search params for stats-level filtering.
  - Loads `getLibraryStats(tagFilter, yearFilter)` and `listTags()`.
  - Renders hero metrics, `MoviesOverTime`, genre breakdown, rating distribution, language breakdown, and tag breakdown.
  - Genre and language visual components currently live in this file.
  - Genre and language breakdown items link to `/library` with matching filters, the active watched year if present, and `from=stats`.
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
  - Loads media analytics rows and delegates aggregation to `buildMediaLibraryStats()`.
- Stats transforms: `lib/db/queries/stats-transforms.ts`
  - Builds watched summaries from media activity rows.
  - Builds genre, language, tag, rating, month, and year stats.
  - `availableYearBuckets` is computed after tag filtering but before year filtering so the stats year selector remains populated.
  - Year-filtered stats use watched years from `media_watch_activity.watched_at`; month buckets are fixed to Jan-Dec for that selected year.
  - Month bucket keys are `YYYY-MM`.
  - Year bucket keys are `YYYY`.
  - Genre breakdown keys are lower-cased genre labels.
  - Language breakdown keys are lower-cased original language codes, labels use `Intl.DisplayNames`.

### Navigation and return paths

- Shell layout and bottom nav: `app/(shell)/layout.tsx`, `components/navigation/bottom-pill-nav.tsx`
  - Bottom nav includes `/library`, `/wishlist`, `/stats`, and `/search`. (`/movies` and `/to-watch` redirect to these.)
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

- Media metadata table:
  - `media_items.primary_genre_name`
  - `media_items.original_language`
  - `media_items.release_year`
- User media table:
  - `user_media.status`
  - `user_media.last_watched_at`
  - `user_media.personal_rating`
- Watch history table:
  - `media_watch_activity.media_id`
  - `media_watch_activity.watched_at`
  - Stats month/year buckets are based on `media_watch_activity`, not just `user_media.last_watched_at`.
- User tags:
  - `tags.name`
  - `user_media_tags.media_id`
  - `user_media_tags.tag_id`

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

- **Never create a branch. Commit and push directly to `main`.** This is a hard rule and overrides
  any generic "branch off the default branch first" habit. There are no feature branches in this
  repo; every commit goes straight to `main`. Do not run `git checkout -b`, `git branch`, or open PRs
  unless the user explicitly asks for a branch in that same message.
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

- When a task is repo-specific, anchor the answer to `AGENT.md` and the Nodi docs instead of generic advice.
- If a requested change would break one of the product invariants above, call that out directly before implementing.
- When changing schema, mention the migration file and any affected Supabase documentation.
- When changing behavior, keep the relationship between `docs/product.md`, `docs/architecture.md`, and `supabase/db_guide.md` coherent.
- Default to discussion before implementation, even when the requested code change seems straightforward, unless the user explicitly asks for direct execution.
