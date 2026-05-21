## Todo

## Done

### 83 — 2026-05-21 — App-Wide Image Cache And Prefetch

Files: `components/media/credit-poster-card.tsx`, `components/media/tmdb-image-prefetcher.tsx`, `components/movie/movie-detail-view.tsx`, `components/movie/movie-library-grid.tsx`, `components/movie/poster-card.tsx`, `components/person/person-detail-view.tsx`, `components/search/movie-search.tsx`, `lib/providers/tmdb/images.ts`, `next.config.ts`, `public/sw.js`

- Audited poster, backdrop, cast, search, provider-credit, and person image usage across Movies, To Watch, movie detail, actor detail, and search surfaces.
- Centralized TMDB image URL, role sizing, optimized-image prefetch URL generation, dedupe, and mobile size guardrails in `lib/providers/tmdb/images.ts`.
- Added a client prefetch bridge that batches optimized image URLs, skips constrained connections, and avoids duplicate browser fetches across mounted views.
- Added a bounded service-worker image cache with duplicate in-flight request coalescing and prefetch message support.
- Converted search result posters from direct CSS TMDB backgrounds to `next/image`, and wired list/detail/person surfaces to shared sizing and prefetch behavior.

### 1 — 2026-05-05 — Foundation

Files: legacy entry; changed files not recorded

- Added env examples, Supabase clients, shared fetch/error helpers, typed env access, and base app utilities.
- Established the initial app foundation that later feature work built on.

### 2 — 2026-05-05 — Auth And Session

Files: legacy entry; changed files not recorded

- Wired Supabase auth into the shell.
- Added sign-in/sign-out flow.
- Protected authenticated screens.

### 3 — 2026-05-05 — Database Integration

Files: legacy entry; changed files not recorded

- Connected Supabase migration flow.
- Added typed query/mutation layers and app-owned DB types.
- Added validation for movie payloads, watch actions, tags, and ratings.

### 4 — 2026-05-05 — TMDB Search And Ingestion

Files: legacy entry; changed files not recorded

- Built `GET /api/search/movies`.
- Added TMDB client/adapters and normalized search results.
- Switched TMDB access to per-user encrypted credentials.
- Made TMDB detail browsing read-only until explicit save.

### 5 — 2026-05-05 — Real Search Screen

Files: legacy entry; changed files not recorded

- Replaced stub search with debounced `/api/search/movies` flow.
- Search results show watched, to-watch, and rating state.
- Unsaved TMDB results route to read-only remote detail before local write.
- Added loading, empty, error, and selection states.

### 6 — 2026-05-05 — Movie Detail

Files: legacy entry; changed files not recorded

- Added Supabase-backed movie detail with hero, plot, cast, tags, and details.
- Added state-aware watched/watchlist/remove actions, rating picker, tag display, and overview expand/collapse.
- Added movie detail Server Actions and revalidation for Movies and To Watch.

### 7 — 2026-05-05 — Movies And To Watch

Files: legacy entry; changed files not recorded

- Added watched-movie poster grid with genre filter chips.
- Converted To Watch to a matching poster grid.
- Improved empty states.

### 8 — 2026-05-05 — Watch Actions And Local-First State

Files: legacy entry; changed files not recorded

- Added Supabase-first writes for watched status, explicit watch dates, ratings, watchlist, and tags.
- Enqueued pending Trakt `sync_events` after local writes.
- Added grants/RLS for authenticated sync event writes.
- Added detail controls for extra watch dates and tag add/remove.

### 9 — 2026-05-05 — Stats

Files: legacy entry; changed files not recorded

- Added watch-log analytics queries and stats transforms.
- Watched count/runtime now derive from `watch_logs`.
- Added paged stats reads plus language, tag, genre, and monthly watched breakdowns.

### 10 — 2026-05-05 — Provider Credentials And Trakt Sync

Files: legacy entry; changed files not recorded

- Added app-level encrypted provider credentials using `PROVIDER_SECRETS_KEY`.
- Added per-user TMDB and Trakt credential storage and settings routes.
- Added Trakt OAuth connect/callback routes, client, adapters, credential loading, reconcile logic, cursors, and sync event logging.
- Built `/api/sync/trakt/push`, `/api/sync/trakt/pull`, and `/api/sync/trakt/status`.

### 11 — 2026-05-05 — PWA Completion

Files: legacy entry; changed files not recorded

- Expanded manifest identity, scope, screenshots, install shortcuts, and icons.
- Added `public/sw.js`, `public/offline.html`, production service-worker registration, and offline navigation fallback.
- Added service-worker headers, proxy exclusions, and mobile safe-area shell spacing.

### 12 — 2026-05-05 — Hardening

Files: legacy entry; changed files not recorded

- Added Vitest and `npm run test`.
- Added focused tests for TMDB adapters, Trakt adapters, validation, stats transforms, and mutation state helpers.
- Added protected-shell `error.tsx` and `not-found.tsx`.
- Verified `npm run test`, `npm run lint`, `npm run build`, and production smoke checks.

### 13 — 2026-05-05 — Stabilize Sync Runs

Files: legacy entry; changed files not recorded

- Added durable `sync_runs` lifecycle state, one active run per user/provider, cancellation, stale-run failure marking, and progress fields.
- Added `POST /api/sync/trakt/stop` and Stop sync UI.
- Switched pull/push progress from pending progress events to `sync_runs`.
- Recovered duplicate Trakt OAuth callbacks when connection state is already active.

### 14 — 2026-05-05 — Bulk Bootstrap Pull

Files: legacy entry; changed files not recorded

- Changed pull to fetch provider pages first, then reconcile movies, mappings, user state, and watch logs in bulk.
- Replaced item-by-item movie resolution and user-state writes with bulk read/write paths.
- Imported unknown Trakt movies as minimal TMDB-keyed metadata when possible.
- Added item-level failure samples to pull summaries.

### 15 — 2026-05-05 — Incremental Sync Cursors

Files: legacy entry; changed files not recorded

- Added stable cursor helpers for history, watchlist, ratings, list snapshots, and phase checkpoints.
- Split pull reconciliation into history, watchlist, and rating phases with checkpoints after each phase.
- Watchlist/rating snapshots skip local reconciliation when unchanged.
- Preserved pending-local-push protection for remote watchlist/rating removals.

### 16 — 2026-05-05 — Trakt Lists As Nodi Tags

Files: legacy entry; changed files not recorded

- Added Trakt user-list and list-movie pagination client endpoints.
- Pull now imports Trakt user lists after ratings and resolves list movies through the bulk movie path.
- Trakt list names create/reuse local Nodi tags and upsert `user_movie_tags` links without outbound tag push events.
- Stored per-list `lists.<id>.snapshot` cursors plus `pull.lists.completed_at`.

### 17 — 2026-05-05 — Trakt List Tag Snapshot Reconciliation

Files: legacy entry; changed files not recorded

- Added snapshot-delta reconciliation for Trakt list imports.
- First import tags all current remote list movies; later pulls tag only newly remote-added movies.
- Unchanged lists skip tag/link writes so local tag removals are preserved.
- Remote list removals advance snapshots without detaching local Nodi tags.

### 18 — 2026-05-05 — Progress Tracking Cleanup

Files: legacy entry; changed files not recorded

- Simplified `progress.md` to two top-level sections only: `Done` and `Todo`.
- Reordered completed work newest first and removed the duplicated current-context/roadmap sections.
- Added the future Trakt sync roadmap only under `Todo`.
- Updated `docs/agent.md` so assigned tasks must read and update `progress.md`.

### 19 — 2026-05-05 — Metadata Backfill And Lazy Enrichment

Files: legacy entry; changed files not recorded

- Added a TMDB metadata enrichment marker so Trakt can keep importing minimal rows without blocking on TMDB detail/credits.
- Added lazy enrichment for local movie detail pages; TMDB failures or missing tokens fall back to the minimal local page.
- Added a manual TMDB metadata backfill button under TMDB settings and a `POST /api/movies/tmdb/backfill` route.
- Backfill uses current-user movie/tag rows plus TMDB provider mappings to hydrate missing posters, plot, runtime, votes, and cast.

### 20 — 2026-05-05 — Trakt List Fetch Efficiency

Files: legacy entry; changed files not recorded

- Added `lists.<id>.metadata` cursors from Trakt list item count, normalized tag name, and update timestamp.
- Trakt pull now skips unchanged list item-page fetches when metadata matches and a prior item snapshot exists.
- Skipped lists reuse their stored item snapshots, preserving additive list-tag reconciliation and local tag removals from task 17.
- Pull summaries now include `listItemFetchesSkipped`, and architecture docs describe the metadata cursor behavior.

### 21 — 2026-05-05 — Retryable Item-Level Sync Failures

Files: legacy entry; changed files not recorded

- Added `sync_item_failures` as durable retry context for item-level Trakt pull/list failures.
- Trakt pull now records compact summary samples while persisting pending failure rows with phase, item key, run id, error, and attempt count.
- Pending failure rows are flushed before history/watchlist/rating/list checkpoints or pull cursors advance, so retry context survives snapshot movement.
- List item-page fetch failures are recorded per list and skipped without advancing that list snapshot.

### 22 — 2026-05-05 — Movie Detail Page UI Overhaul

Files: legacy entry; changed files not recorded

- Hero right column reordered: title → meta (13px) → status (own line, semantic colour) → rating button (own line) → TMDB 13px text-muted (up from 11px) → tags. Column is now self-start instead of self-centered.
- Action buttons (Mark Watched / Watchlist / Remove) kept below poster row as full-width h-11 first-class CTAs.
- Replaced 10-tap inline RatingPicker with RatingSheet: a tappable "♥ 8 ▾" / "♥ Rate ▾" button in the hero that opens a bottom sheet listing 1–10 with descriptive labels (Awful → Masterpiece), current rating highlighted in accent, clear option at bottom.
- Removed card wrapper (rounded-2xl border bg-surface) from Details and Watch History sections — DetailRow rows now sit flat on page bg per design.md.

### 23 — 2026-05-05 — Trakt List Re-Tag On Full Fetch

Files: legacy entry; changed files not recorded

- Changed `normalizeListStates` so that when list item pages are actually fetched, all current movies are included in `movieStatesToTag`, not just delta additions.
- This is idempotent (upsert with onConflict) and self-healing: any list whose tag links are in a partial state (e.g. due to a mid-sync rename) will be corrected on the next full fetch.
- Removed the fragile tagName-change detection added in the previous hotfix; the always-retag approach supersedes it and handles all cases including renames whose cursor already advanced.
- Added `parseListMetadataCursor` utility to `sync-cursors.ts` (kept for future use).

### 24 — 2026-05-05 — TMDB Backfill Auto-Loop

Files: legacy entry; changed files not recorded

- Backfill button now loops automatically until `remaining === 0`, batching 50 movies per request.
- Live status counter shows "Enriched X · Y remaining" during the run.
- Stop button (square icon) interrupts the loop cleanly between batches.
- Final status shows "Done — X enriched · Y failed" on completion.

### 25 — 2026-05-05 — UI Polish — Backgrounds, Inputs, Buttons

Files: legacy entry; changed files not recorded

- Swapped light-mode token values: `--bg-primary` → `#FFFFFF` (white pages), `--bg-secondary` → `#F2F2F7` (card/surface areas), `--bg-nav` → `rgba(255,255,255,0.90)`. Dark mode unchanged. Eliminates the "hospital grey" page background throughout the app.
- Updated `docs/design.md` §10 token reference to match new values.
- Replaced native `<input type="date">` in `WatchDateForm` with an overlay pattern: formatted date string displayed in a styled row, hidden input covering the tap area. Opens native date picker on press; looks clean regardless of browser.
- Added `WATCHED ON` and `TAGS` section labels (footnote, uppercase, text-faint) above the date and tag editors per SectionDivider pattern.

### 26 — 2026-05-05 — Stats Screen Overhaul + Settings Button Fixes

Files: legacy entry; changed files not recorded

- Reordered sections: Movies watched → Time watched → Over time → By genre → By tag → By rating → By language.
- `formatRuntime` now includes remaining minutes in the days case (e.g. `5d 14h 22m`).
- Replaced horizontal progress bars with chip/pill grid for genre, tag, and language breakdowns. Each chip shows label + count in a wrapping flow; genre = green tint, tag = orange tint, language = blue tint.
- Added "By rating" mini bar chart: 10 vertical bars (ratings 1–10), counts from `user_movies.personal_rating`; shows empty state when no ratings.

### 27 — 2026-05-05 — Stats Redesign + Movie Detail Form Polish

Files: legacy entry; changed files not recorded

- Removed all card wrappers (`rounded-2xl border bg-surface`); all sections now flat on page bg, separated by `border-divider` lines and 17px semibold section headers.
- Primary hero row: Movies / Time watched / ♥ avg rating — three inline metrics, no cards. Heart (`♥`) in front of avg rating number, watched-green color. Font auto-truncates for long time values.
- Secondary hero row: Avg runtime / Fav genre / Fav decade — muted 15px semibold, same inline pattern.
- New stats fields: `avgRating` (weighted mean from rated movies), `avgRuntimeMinutes` (runtime ÷ watched count), `favGenre` (top genre label, Unknown excluded), `favDecade` (decade of release year of most-watched movies, e.g. "2000s"). Added `release_year` to watch-log analytics query.

### 28 — 2026-05-05 — Fix TMDB Backfill Scan Window

Files: legacy entry; changed files not recorded

- Root cause: `loadCurrentUserImportedMovieIds` applied `.limit(scanLimit)` (500) to `user_movies` ordered by `updated_at DESC`, so libraries with 500+ movies never reached older unenriched entries. User had 990 movies; 269 were permanently invisible to the backfill.
- Fix: removed the limit from the ID fetch (`loadCurrentUserMovieIds`), then replaced `loadMovieMapByIds` with `loadUnenrichedMoviesByIds` — a new function that filters `tmdb_enriched_at IS NULL` at the DB level before loading movie rows. The scan limit now applies to the unenriched set, not the full library.
- Removed the now-unused `loadMovieMapByIds` function.

### 29 — 2026-05-05 — Movie Detail Page Polish — Hero, Rating Sheet, Tag Picker, Details

Files: legacy entry; changed files not recorded

- **Hero layout (Option B)**: Title moved below the poster/meta grid to full width — long titles never compress the right column. Right column now shows: meta line → status → rating row (user + TMDB inline) → tags. TMDB rating appears as `· ★ 7.5` inline next to the `♥ 8 ▾` rating button.
- **Details section**: Added `TMDB rating` row (`7.5 · 1,234 votes`), replacing the former `TMDB votes`-only row. Removed horizontal dividers from Detail rows within the Details section (`divider={false}` prop added to `DetailRow`); Watch History rows retain their dividers.
- **Rating sheet**: iOS list-menu style. Number is now primary — 17px semibold, text-primary (or accent when selected) — left-aligned. Label is secondary — 15px text-2 (or accent when selected) — fills the remaining space. Checkmark at far right for current selection.
- **Tag picker**: Current tags on movie display as a single horizontal-scroll row (no wrapping). Available-tag suggestions only appear when the user has typed a search term, filtered to name matches (e.g. typing "str" shows "Stremio"). Input row always present at the bottom.

### 30 — 2026-05-05 — Multi-Select Bulk Operations on Movies and To Watch

Files: legacy entry; changed files not recorded

- Added "Select / Done" toggle button to the poster grid header in `MovieLibraryGrid`.
- In selection mode, tapping a poster card toggles it selected (checkmark overlay, accent ring). Navigation link is suppressed; tap triggers selection.
- When one or more movies are selected, a `BulkActionsBar` floats above the bottom nav with Tag, Rate, and Watch/Unwatch actions.
- Tag sheet (`BulkTagSheet`): Add or Remove tabs. Add tab lists all user tags (+ to attach to all selected) plus a new-tag input. Remove tab lists tags with × to detach from all selected.

### 31 — 2026-05-05 — Stats Polish + Tighter Movies Grid Spacing

Files: legacy entry; changed files not recorded

- **Heart size**: avg rating ♥ rendered at 14px inline span so the number (22px) dominates.
- **Time watched column**: `flexGrow 1.5` so the full `Xd Yh Zm` string won't truncate.
- **Fav genre count**: `favGenreCount: number | null` added to `LibraryStats`; displays as "Action (24)" in secondary hero.
- **Watched with Amele**: `ameleWatchMinutes: number` added to `LibraryStats`; computed in `stats-transforms.ts` by cross-joining tagRows × watchRows for tag name "amele" (case-insensitive). Replaces "Avg runtime" in the secondary hero row.

### 32 — 2026-05-05 — Sort, Filter & Tag Style — Movies and To Watch Grids

Files: legacy entry; changed files not recorded

- **Sort/filter toolbar**: replaced lone "Select" button row with a toolbar row `[Sort ▾] [Filter ▾]` + `Select` anchored top-right. During selection mode the pills hide and show selection count instead.
- **Sort sheet**: tap to select with default direction; tap the already-selected option again to toggle asc/desc. Direction label shown inline on selected row ("Latest first", "High to low", "A → Z" etc).
- **Grouping — watched_date / added_date**: sorted by date now groups posters by calendar month ("May 2026", "April 2026", …). Sections only appear when movies exist for that month.
- **Grouping — rating**: sorted by rating groups by integer value ("9", "8", …, "Unrated"). Flat divider line with label separates each group.

### 33 — 2026-05-05 — Stats Hero Layout Polish + Generic Co-Watch Stat

Files: legacy entry; changed files not recorded

- **Column alignment**: replaced two separate `flex` rows with a single CSS grid (`1fr 1.5fr 1fr`). Both rows now share identical column boundaries — previously flex distributed space based on content min-width, causing visible misalignment.
- **HeroMetric**: swapped `flexGrow` prop for explicit `border` prop; removed `[&+&]` sibling-selector borders which broke when rows shared a grid container.
- **Fav genre count**: moved from the value string `"Action (350)"` to an inline annotation inside the value ReactNode — genre name at full weight/size, count at 12px `text-text-faint font-normal`. Label is plain "Fav genre".
- **Generic co-watch stat**: renamed `ameleWatchMinutes` → `coWatchMinutes` throughout (`types.ts`, `stats-transforms.ts`, `stats.ts`, `stats/page.tsx`). Tag name read from `STAT_CO_WATCH_TAG` env var; label renders as "Watched with \<tag\>". Metric shows 0 / "—" when env var is unset. Added to `.env.example`.

### 34 — 2026-05-05 — Theme Picker in Settings

Files: legacy entry; changed files not recorded

- **Migration**: `supabase/migrations/20260510165000_add_user_preferences.sql` creates `user_preferences` table with `user_id` PK, `co_watch_tag`, `theme` (null | 'light' | 'dark'), and `updated_at`. RLS policies scoped to `auth.uid()`.
- **DB types**: added `user_preferences` table to `Database` type; exported `UserPreferences` and `Theme` aliases from `lib/db/types.ts`.
- **Query**: `getUserPreferences()` in `lib/db/queries/preferences.ts`.
- **Mutation**: `upsertUserPreferences()` in `lib/db/mutations/preferences.ts` (upsert on conflict `user_id`).

### 35 — 2026-05-05 — Movie Detail Layout Tightening

Files: legacy entry; changed files not recorded

- **Title moved next to poster**: `<h1>` relocated from below the poster grid to the top of the right column — wraps naturally for long titles, fills the previously empty right column.
- **Tag editor moved**: shifted from between the action button and Plot to after Cast — Plot and Cast now appear immediately below the action area without scrolling past tag controls.
- **Spacing reduced**: `space-y-6` → `space-y-4` on `<main>`, removed `space-y-3` from hero section wrapper, `space-y-1.5` → `space-y-2` in right column.

### 36 — 2026-05-05 — Stats Redesign — Tag Filter, Viz Overhaul, Avg Runtime

Files: legacy entry; changed files not recorded

- **Tag filter**: scrollable chip row above hero; "All" + one chip per user tag. Active chip selected via URL param `?tag=name`. All stats (count, runtime, genre, language, rating, time buckets) filter to movies tagged with the selected tag.
- **Co-watch removed**: dropped `STAT_CO_WATCH_TAG` env var, `coWatchMinutes` field from `LibraryStats`, and `buildTagWatchMinutes`. Secondary hero middle slot replaced with **Avg runtime** (already computed, zero query change).
- **Section order**: Hero → Over time → By genre → By rating → By language → By tag.
- **By genre**: brought back using `ProportionBreakdown` (stacked bar + dot legend), separate `GENRE_COLORS` palette from language.

### 37 — 2026-05-05 — Stats UI Refinements — Tag Filter, Genre Treemap, Legend Contrast

Files: legacy entry; changed files not recorded

- **Tag filter**: replaced scrollable pill row with a compact inline dropdown button (`StatsTagFilter`, `"use client"`) that lives in the header row alongside the settings icon. Inactive: subtle border + grey "All movies" text. Active: accent-orange border + orange tag name. Native `<select>` overlaid for tap interaction; calls `router.push` on change.
- **Genre viz**: replaced `ProportionBreakdown` (stacked bar + legend) with `GenreTreemap` — two flex rows of colored rectangles where area encodes count. Top row: 2 largest genres. Bottom row: remaining genres (up to 8 total). Row heights proportional to combined counts. Name + count labeled inside each cell. No separate legend.
- **Language legend**: dot size 7px → 9px, text 12px → 13px, count color `text-text-faint` (25% opacity) → `text-text-2` (60%) — readable in dark theme.

### 38 — 2026-05-05 — Rating Button Tap Target — HIG and Design Guide Compliance

Files: legacy entry; changed files not recorded

- **Root cause**: `RatingSheet` trigger button had no `minHeight`, giving it a ~22px tap target well below the HIG 44pt minimum.
- **Fix**: added `style={{ minHeight: 44 }}` to the button so the touch area meets HIG (design.md §5).
- **Icon**: heart icon increased from `h-4 w-4` (16px) to `h-5 w-5` (20px), matching design.md §8 icon sizing for list-row contexts.
- **Active state**: when rated, button and heart render in `text-accent` / `fill-accent/20` to signal personal active state (design.md §2 active/selected state, §9 user rating framing). Unrated state remains muted.

### 39 — 2026-05-05 — Movie Detail — Release Date Format, Full Language, Watch History Edit/Delete, Header Contrast

Files: legacy entry; changed files not recorded

- **Release date**: "Release" detail row now formats `release_date` as "28 Aug 1953" (day + short month + year, `en-GB` `Intl.DateTimeFormat`) instead of raw "1953-08-28". Helper `formatReleaseDate()` added to `movie-detail-view.tsx`.
- **Language full name**: both the hero meta line and the "Language" detail row now show the full `Intl.DisplayNames` English name (e.g. "English", "Korean") instead of the ISO code ("EN", "KO"). Stats page already used `Intl.DisplayNames` and is unchanged.
- **Watch history edit/delete**: replaced the static read-only watch log list with `WatchHistoryEditor` (client component). Each row shows formatted date + pencil (edit) + trash (delete) buttons with 44pt tap targets. Tap pencil → row switches to inline date picker with Save / ✕ Cancel. Tap trash → deletes the entry immediately. New mutations: `deleteWatchLog()` and `updateWatchLogDate()` in `lib/db/mutations/movies.ts` (both scoped by user_id; RLS covers it). New shared actions: `deleteWatchLogAction`, `updateWatchLogDateAction` in `app/(shell)/movie/actions.ts`, re-exported from `[movieId]/actions.ts`.
- **Section header contrast**: all section headers in `movie-detail-view.tsx` moved from `text-text-faint` (25% opacity) to `text-text-muted` (40% opacity) — readable as structural labels while still clearly subordinate to content.

### 40 — 2026-05-05 — Fix: Watch Log Edit/Delete Not Updating last_watched_at

Files: legacy entry; changed files not recorded

- **Root cause**: `updateWatchLogDate` and `deleteWatchLog` only wrote to `watch_logs`, never touching `user_movies.last_watched_at`. Sort order ("Latest watched") uses that field, so edits and deletes had no effect on sort position.
- **Fix**: added `resyncLastWatchedAt()` helper in `lib/db/mutations/movies.ts` — after each write it queries `MAX(watched_at)` from `watch_logs` for the movie/user and writes it back to `user_movies.last_watched_at`. Delete edge case: if all logs are removed, sets `last_watched_at` to `null`.
- Both mutation signatures now take `movieId` as first arg (was `logId`-only); callers in `app/(shell)/movie/actions.ts` updated accordingly.

### 41 — 2026-05-05 — Fix: last_watched_at Still Stale After Watch Log Delete (trigger approach)

Files: legacy entry; changed files not recorded

- **Root cause revisited**: commit `1011925` added `resyncLastWatchedAt()` in app code, but it was fragile — a Supabase `.update()` with no matching rows returns no error, silently no-oping. Pre-existing stale data (e.g. Baasha: `last_watched_at = 2026-05-10` but max log = `2026-03-24`) was never repaired.
- **Fix**: replaced app-level resync with a `AFTER INSERT OR UPDATE OR DELETE` Postgres trigger (`sync_last_watched_at`) on `watch_logs`. Fires per row, recomputes `MAX(watched_at)`, writes back to `user_movies.last_watched_at`. `SECURITY DEFINER` to bypass RLS inside the trigger body.
- Removed `resyncLastWatchedAt()` from `lib/db/mutations/movies.ts`; `deleteWatchLog` and `updateWatchLogDate` no longer need `movieId` for the resync (kept it for validation).
- Migration `20260511230000_sync_last_watched_at_trigger.sql`: creates trigger + repairs all stale `user_movies` rows.

### 42 — 2026-05-05 — Fix: Watch Log Icon Buttons 44×44pt (HIG)

Files: legacy entry; changed files not recorded

- Pencil, trash, and cancel (✕) buttons in `WatchHistoryEditor` had `minWidth: 36` — below the HIG 44pt minimum. Changed to `minWidth: 44`.
- Verified: `tsc --noEmit` clean.

### 43 — 2026-05-05 — Movies: Persist filters/sort + HIG tap targets + Reset button

Files: legacy entry; changed files not recorded

- Sort and filter state now persist in `localStorage` (keyed by `pageStatus`) and hydrate on mount, so navigating away and back preserves the selected sort/filter.
- `clearFilters` also removes the localStorage entry so reset is clean.
- Added inline "✕" reset button in the toolbar (appears when any filter is active).
- Sort, Filter, and Select/Done buttons bumped to `h-11` / `minHeight: 44` to meet HIG 44pt minimum tap target.

### 44 — 2026-05-11 — Stats Drill-Downs + URL-Backed Movies Filters

Files: legacy entry; changed files not recorded

- Stats genre, language, month, and year breakdown items now link into `/movies` with matching URL filters and an explicit Stats return path.
- `/movies` now parses URL filters for genre, language, repeated tag, rating/ratingOp, watched year, and watched month. Clearing filters stays on `/movies` and removes drill-down params.
- Movies filter sheet exposes the same filter dimensions directly on the Movies screen; watched date is limited to year/month buckets only.
- `listUserMovies()` applies watched-library filters server-side. Genre/language/rating filter on joined movie/user fields; tag and watched-date filters resolve movie ids and intersect them. Month (`YYYY-MM`) takes precedence over year (`YYYY`).

### 45 — 2026-05-11 — Movie Toolbar Tap Targets + Docs

Files: legacy entry; changed files not recorded

- Fixed Movies/To Watch library toolbar affordances: Sort and Filter remain 44px-high icon+label pills, and active filter reset is now a separate 44x44 icon button using lucide `X`.
- Updated tracked docs for the toolbar contract and product behavior: `docs/design.md`, `docs/product.md`, and `docs/agent.md`; the temporary mock update was superseded by removing archived HTML mocks in entry 44.
- Commits: toolbar fix `9c2e5fb`, docs `fcaf416`; both pushed to `origin/main`.

### 46 — 2026-05-11 — Remove Archived HTML Design Mocks

Files: legacy entry; changed files not recorded

- Removed both tracked HTML mock files from `docs/`: `docs/sort-filter-tags-mock.html` and `docs/stats-redesign-mock.html`.
- Checked for remaining references; none remain besides unrelated test terminology.

### 47 — 2026-05-12 — Centralize Bottom Sheet Shell

Files: legacy entry; changed files not recorded

- Root cause for the repeated bottom-nav overlap: previous work fixed individual UI details, but each sheet had its own hard-coded backdrop, z-index, safe-area padding, and scroll behavior. The movie rating sheet, bulk rating/tag sheets, and library sort/filter sheets could drift independently.
- Added shared `components/ui/bottom-sheet.tsx` that owns the backdrop layer, sheet layer above `BottomPillNav`, safe-area bottom padding, viewport max-height, and scrolling.
- Refactored `RatingSheet`, `BulkRatingSheet`, `BulkTagSheet`, and `MovieLibraryGrid` sort/filter sheets to use the shared component.
- Verified no remaining app-level hard-coded bottom-sheet shells with `rg`; only the shared component contains the fixed `inset-x-0 bottom-0` sheet shell.

### 48 — 2026-05-12 — Fix npm Security Advisories

Files: legacy entry; changed files not recorded

- Bumped `next` from `16.2.4` to `16.2.6`, clearing the high-severity Next.js advisories reported by Dependabot.
- Added npm `overrides.postcss = 8.5.14` so Next's nested vulnerable `postcss@8.4.31` resolves to the patched PostCSS version.

### 49 — 2026-05-12 — Public Release Security Hardening

Files: legacy entry; changed files not recorded

- Wrote local ignored audit report at `docs/nodi_security_audit.md` and added it to `.gitignore`.
- Removed client-visible serialized provider/action errors from redirects, query strings, session storage, and browser console paths.
- Added baseline app security headers in `next.config.ts` including CSP, referrer policy, no-sniff, frame denial, permissions policy, and HSTS.
- Added lightweight in-process rate limiting for auth attempts, TMDB search/backfill, Trakt OAuth connect/callback, and Trakt sync push/pull/stop. Status polling remains unlimited for progress updates.

### 50 — 2026-05-15 — Trakt Push Batching + Item-Level Sync Progress

Files: legacy entry; changed files not recorded

- Push sync now batches adjacent compatible pending events into one Trakt request while preserving queue order. History adds, history removals, watchlist adds/removals, rating sets, and rating removals each batch independently; local-only tag sync events still skip as before.
- Added persisted item-level sync progress on `sync_runs` so the Trakt settings UI can show counts such as `41/143 history items` during pulls and `17/50 events` during pushes while retaining coarse overall run progress.
- Pull progress now uses Trakt pagination totals when available for history, watchlist, and ratings, and shows reconcile item counts once the pull plan is known.
- Updated sync architecture/database docs for the new batching and progress model.

### 51 — 2026-05-15 — Mockup Storage Rule Clarification

Files: legacy entry; changed files not recorded

- Clarified in `docs/agent.md` that generated UI previews shown during repo work count as mockups and must be copied into local gitignored `mocks/` before being presented or referenced.
- Moved the current settings/sync preview into `mocks/settings-sync-flow.png`; `mocks/` remains ignored and must not be committed.

### 52 — 2026-05-17 — Compact Movie Detail Watch History Flow

Files: legacy entry; changed files not recorded

- Movie detail now summarizes watched state inline in the hero: one watch shows `Watched · <date>`, while rewatches show `Watched xN · Last watched <date>`.
- Replaced the always-visible watch-date row and page-level history list with a compact `Watch history` disclosure row that opens a bottom sheet for full dates, edit/delete controls, and explicit `Log rewatch` entry.
- Updated tracked docs for the resolved rewatch behavior and movie-detail interaction contract.

### 53 — 2026-05-17 — In-Control Async Feedback Cleanup

Files: legacy entry; changed files not recorded

- Standardized initiated-action feedback outside the watched-state buttons: auth actions, watch-date logging, tag creation, watch-history save/delete, local rating saves, bulk rating/tag saves, and search-result opening now show an in-control activity indicator instead of bare ellipses or silent disabling.
- Preserved local action context so the spinner appears only on the button, row, or poster that started the request.

### 54 — 2026-05-17 — Explicit Bottom-Sheet Dismissal Paths

Files: legacy entry; changed files not recorded

- Added a shared opt-in close affordance to `BottomSheet` plus Escape-key dismissal so modal sheets no longer depend only on backdrop taps to close.
- Enabled the explicit close path for watch history, bulk tags, bulk ratings, and the watched-library filter sheet.

### 55 — 2026-05-17 — Watch-History Delete Confirmation

Files: legacy entry; changed files not recorded

- Added an inline confirmation step before watch-history deletion so tapping the trash icon no longer performs the destructive action immediately.
- Confirmation stays scoped to the selected history row with explicit `Cancel` and `Delete` actions; edit mode and sheet close reset the pending confirmation state.

### 56 — 2026-05-17 — Explicit Movie-Library Sort And Filter Flow

Files: legacy entry; changed files not recorded

- Reworked the library sort sheet so sort choice and direction are separate controls, and changes only commit through an explicit `Done` action instead of repeat-tapping the selected row.
- Reworked the filter sheet so `Clear filters` resets the staged draft and `Apply filters` is the only sheet action that commits URL-backed filters.
- Updated the product/agent docs to match the new sort/filter contract.

### 57 — 2026-05-17 — Search Affordance Polish

Files: legacy entry; changed files not recorded

- Added an explicit in-field clear control for non-empty queries and suppressed the browser-native search cancel affordance so the control is consistent across clients.
- Moved active search progress into the search field and kept selected-result opening progress local to the chosen poster with `aria-busy` state.
- Updated the product and architecture docs to record the search interaction contract.

### 58 — 2026-05-17 — Appearance Semantics + Bottom-Nav Decision

Files: legacy entry; changed files not recorded

- Replaced the Appearance picker button-toggle semantics with native radio inputs while preserving the segmented visual treatment, immediate theme updates, and visible keyboard focus.
- Recorded the product decision to keep the floating bottom navigation as an intentionally branded pill instead of moving toward a conventional full-width tab bar.

### 59 — 2026-05-17 — Repo-Specific Progress File Rename

Files: legacy entry; changed files not recorded

- Renamed the local task log from `progress.md` to `progress_nodi.md` so the file is explicitly tied to this repo.
- Updated `docs/agent.md` and `.gitignore` so future work reads, maintains, and ignores the new file name consistently.

### 60 — 2026-05-17 — Remove Duplicate Work From Add / Detail Flow

Files: legacy entry; changed files not recorded

- Removed the redundant `router.refresh()` after remote TMDB save redirects.
- Reused the remote detail page's normalized TMDB payload through bound server actions so watched and watchlist saves no longer refetch TMDB details plus credits before ingestion.
- Added request-local caching for the initial local detail load so metadata generation and page render share the same fetch, while preserving the fresh reload after lazy enrichment.
- Added adapter coverage for the normalized reusable ingest payload.

### 61 — 2026-05-17 — Replace Full Stats Work On `/movies` With A Lightweight Summary

Files: legacy entry; changed files not recorded

- Replaced `/movies` usage of `getLibraryStats()` with `getWatchedLibrarySummary()`, which loads only watched movie ids, watch dates, genre, and language needed for the header and filter options.
- Kept full analytics loading on `/stats` only, while preserving the existing watched-count deduplication, genre/language option labels, and month/year bucket behavior for the library page.
- Added focused transform coverage for rewatches, empty summaries, and the preserved breakdown/bucket behavior.

### 62 — 2026-05-17 — Paginate The Library And Lazy-Load Posters

Files: legacy entry; changed files not recorded

- Added a paged library query and authenticated `/api/library/movies` endpoint so `/movies` and `/to-watch` start from 48 rows instead of loading up to 1000 rows at once.
- Kept sort/group behavior global across loaded pages by fetching subsequent pages against the active date, rating, or title sort; the grid now auto-loads more on scroll with an explicit fallback button.
- Narrowed the paged library row shape to only the user/movie fields the poster grid needs, and moved poster cards from CSS background images to lazy-loaded `next/image` posters with explicit sizing.

### 63 — 2026-05-17 — Collapse Watched-State Writes Into Fewer Round Trips

Files: legacy entry; changed files not recorded

- Added transactional `apply_movie_watch_state(...)` RPC so single-movie watched, watchlist, repeat-watch, and outbound Trakt sync-event writes complete in one database call instead of serialized app hops.
- Kept existing watch-log semantics by continuing to append explicit `watch_logs` rows and letting the existing trigger recompute `user_movies.last_watched_at` before the RPC returns.
- Routed the single-movie mutation flow through the RPC, documented the new write path, and added focused mutation coverage for watched, watchlist, repeat-watch, and inbound-sync argument behavior.

### 64 — 2026-05-17 — Remove Tag Overfetch From Library Lists

Files: legacy entry; changed files not recorded

- Removed legacy tag hydration from `listUserMovies()` so that list reads no longer query every `user_movie_tags` row for the user.
- Kept watched-library filter tags eager where the UI renders them immediately, but changed `/to-watch` to defer `listTags()` until the user opens the bulk tag sheet.
- Kept tag-aware detail screens on their existing per-movie hydration path and added focused query coverage that fails if `listUserMovies()` starts loading tag rows again.

### 65 — 2026-05-17 — P2 — Align Library Indexes And Filter Execution With Real Queries

Files: legacy entry; changed files not recorded

- Added `user_movies_user_status_watchlisted_idx` so the default `/to-watch` ordering has the same compound-index support as watched-library ordering.
- Added `list_library_movies_page(...)` and moved `listLibraryMoviesPage()` onto that RPC so watched month/year and tag filters execute inside Postgres instead of materializing intermediate movie-id sets and intersecting them in the app process.
- Kept the paged library response shape intact, documented the new query path, and added focused coverage that asserts month precedence plus RPC argument wiring.

### 66 — 2026-05-19 — Bottom Nav Fixed-Position Mitigation

Files: legacy entry; changed files not recorded

- Removed `overflow-x-hidden` from the protected shell wrapper so the fixed bottom pill is no longer nested inside an overflow-clipped ancestor during page scroll.
- Left bottom nav styling unchanged; this is a conservative mitigation for intermittent mobile viewport/compositing drift.

### 67 — 2026-05-19 — Stats Screen Cleanup

Files: legacy entry; changed files not recorded

- Removed the outlier scale helper copy under the Over time chart while keeping the capped bar indicator behavior on the bar itself.
- Removed the `By tag` movie-count breakdown from Stats because tags are now exposed as a top-level stats filter.

### 68 — 2026-05-19 — Resolve npm Security Alerts

Files: legacy entry; changed files not recorded

- Added scoped dependency overrides so `brace-expansion` resolves to `5.0.6` under `minimatch@10.2.5` and Supabase realtime's `ws` resolves to `8.20.1`.
- Refreshed `package-lock.json` without changing direct dependencies.

### 69 — 2026-05-21 — Align Cast Portrait Crops

Files: legacy entry; changed files not recorded

- Replaced cast profile CSS background images with explicit Next `Image` rendering inside the existing circular portrait frame.
- Tuned the object position so TMDB headshots crop more consistently around faces while preserving the current fallback icon for missing profiles.

### 70 — 2026-05-21 — Make Movie Detail Sections Collapsible

Files: `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `components/movie/movie-detail-view.tsx`

- Made the editable Tags panel collapsible on local movie detail pages while preserving the current tag removal, suggestions, and new-tag form behavior.
- Made the Details metadata block collapsible in the shared movie detail view.

### 71 — 2026-05-21 — Align Collapsed Movie Detail Headers

Files: `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `components/movie/movie-detail-view.tsx`, `progress_nodi.md`

- Removed extra horizontal padding from the Tags disclosure header so it aligns with Plot, Cast, and Details.
- Changed Tags and Details disclosures to start collapsed by default.

### 72 — 2026-05-21 — Update Agent Progress Tracking Rules

Files: `docs/agent.md`, `progress_nodi.md`

- Updated `docs/agent.md` so future agents use a globally numbered `Todo`/`Done` progress-log format with explicit file lists and terse outcome bullets.
- Clarified that local progress phrases always refer to `progress_nodi.md` in this repo and should not trigger a search for alternate progress files.
- Kept the repo-specific `progress_nodi.md` name instead of switching to a cross-repo filename.

### 73 — 2026-05-21 — Normalize Local Progress Log Format

Files: `progress_nodi.md`

- Converted the local progress log to the new `## Todo` / `## Done` format.
- Reordered completed entries oldest-first and assigned globally sequential entry numbers.
- Added `Files:` lines to legacy entries, using a legacy placeholder where old file lists were not recorded.
- Kept the app-wide UI standardization sessions as numbered Todo entries for future pickup.

### 74 — 2026-05-21 — UI Standardization Session 1 — Shared Section Primitives And Movie Detail Migration

Files: `components/ui/section.tsx`, `components/movie/movie-detail-view.tsx`, `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `progress_nodi.md`

- Added shared section, header, collapsible-section, and scroll-bleed primitives under `components/ui/`.
- Migrated movie detail Plot, Cast, Tags, and Details to the shared primitives while preserving collapsed defaults and tag editing behavior.
- Removed extra body-level horizontal padding from migrated detail/tag content so page padding stays owned by the shell.
- Verified with `npm run lint` and `npm run build`; lint still reports the existing unrelated `normalizeTagName` warning.

### 75 — 2026-05-21 — UI Standardization Session 2 — Settings And Sheet Row Primitives

Files: `components/ui/settings.tsx`, `app/(shell)/settings/page.tsx`, `app/(shell)/settings/sync/page.tsx`, `app/(shell)/settings/sync/tmdb/page.tsx`, `app/(shell)/settings/sync/trakt/page.tsx`, `components/settings/tmdb-backfill-controls.tsx`, `components/settings/trakt-sync-controls.tsx`, `progress_nodi.md`

- Added shared settings panel, link row, status badge, and field-label primitives.
- Migrated repeated settings and sync-settings navigation rows, bordered panels, connection badges, and credential labels onto the shared primitives without changing actions or data flow.
- Verified with `npm run lint` and `npm run build`; lint still reports the existing unrelated `normalizeTagName` warning.

### 76 — 2026-05-21 — UI Standardization Session 3 — Movie Library Filters And Bulk Action Sheets

Files: `components/ui/section.tsx`, `components/movie/movie-library-grid.tsx`, `components/movie/bulk-rating-sheet.tsx`, `components/movie/bulk-tag-sheet.tsx`, `progress_nodi.md`

- Added shared bottom-sheet section, header, divider, and scroll-bleed primitives for sheet-owned spacing.
- Migrated movie library group labels, sort/filter sheet labels, dividers, and watched filter chip rows to the shared primitives without changing filter/query state.
- Migrated bulk rating/tag sheet sections and preserved the existing bulk mutation handlers, loading states, and error paths.
- Verified with `npm run lint` and `npm run build`; lint still reports the existing unrelated `normalizeTagName` warning.

### 77 — 2026-05-21 — UI Standardization Session 4 — Stats And Remaining Section Labels

Files: `app/(shell)/stats/page.tsx`, `app/(shell)/stats/movies-over-time.tsx`, `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `progress_nodi.md`

- Migrated Stats over-time and breakdown section labels to the shared section/header primitives while preserving chart, filter, and drill-in link behavior.
- Converted the remaining local movie detail `Log rewatch` section label to the shared header primitive.
- Left dense footnotes, badges, counts, and the auth intro copy on their local styles because they are not structural section labels.
- Verified with `npm run lint`, `npm run build`, and `npm test -- tests/db/stats-transforms.test.ts`; lint still reports the existing unrelated `normalizeTagName` warning.

### 78 — 2026-05-21 — UI Standardization Session 5 — Design Docs And Final Consolidation

Files: `docs/design.md`, `components/ui/section.tsx`, `components/ui/settings.tsx`, `app/(shell)/movies/page.tsx`, `app/(shell)/to-watch/page.tsx`, `app/(shell)/search/page.tsx`, `app/(shell)/stats/page.tsx`, `app/(shell)/settings/page.tsx`, `app/(shell)/settings/sync/page.tsx`, `app/(shell)/settings/sync/tmdb/page.tsx`, `app/(shell)/settings/sync/trakt/page.tsx`, `app/(shell)/error.tsx`, `app/(shell)/not-found.tsx`, `components/settings/settings-error-modal.tsx`, `app/globals.css`, `lib/db/mutations/bulk.ts`, `progress_nodi.md`

- Documented the app-wide page/header/section spacing contract, including shell-owned `px-4` padding and scroll-bleed helper usage.
- Added `PageHeader`, `SettingsTextInput`, and `SettingsActionButton`, then migrated repeated page-header and provider-settings form styles to the shared primitives.
- Moved stats chart colours behind CSS tokens and removed the stale unused bulk mutation helper that kept lint noisy.
- Verified with `npm run lint`, `npm run build`, and a dev-server smoke check of protected-route redirect plus `/auth` render.

### 79 — 2026-05-21 — TMDB Person Detail And Shared Detail Primitives

Files: `app/(shell)/person/tmdb/[personId]/page.tsx`, `components/person/person-detail-view.tsx`, `components/movie/movie-detail-view.tsx`, `components/media/credit-poster-card.tsx`, `components/ui/detail.tsx`, `components/ui/section.tsx`, `components/navigation/back-button.tsx`, `lib/providers/tmdb/client.ts`, `lib/providers/tmdb/images.ts`, `app/(shell)/movie/tmdb/[tmdbId]/page.tsx`, `docs/agent.md`, `docs/design.md`, `progress_nodi.md`

- Added a TMDB person detail route from cast member taps, including role context, biography, flat randomized trivia, and Known For credits.
- Extracted reusable detail primitives, TMDB image URL helpers, and a credit poster card so movie/person detail screens share the common pieces without forcing one generic layout.
- Tightened person-detail header spacing, kept typography aligned to the documented display/headline/body/footnote scale, and corrected `SectionHeader` HTML semantics.
- Verified with `npm run lint` and `npm run build`.

### 80 — 2026-05-21 — Movie Detail Cinematic Banner

Files: `components/movie/movie-detail-view.tsx`, `docs/design.md`, `progress_nodi.md`

- Replaced the movie detail top grid with an edge-to-edge cinematic banner driven by `backdrop_path`.
- Kept the poster as the vertical identity anchor and preserved watch state, rating, tag summary, actions, watch history, plot, cast, tags, and details ordering.
- Added a quiet no-backdrop fallback with the same poster/title layout and documented the movie detail hero contract.
- Verified with `npm run lint` and `npm run build`.

### 81 — 2026-05-21 — Wikipedia Trivia For Movie And Actor Detail

Files: `lib/providers/wikipedia/trivia.ts`, `app/(shell)/movie/[movieId]/page.tsx`, `app/(shell)/movie/tmdb/[tmdbId]/page.tsx`, `app/(shell)/person/tmdb/[personId]/page.tsx`, `components/movie/movie-detail-view.tsx`, `components/person/person-detail-view.tsx`, `components/ui/detail.tsx`, `progress_nodi.md`

- Added a conservative Wikipedia/Wikidata trivia provider that resolves by IMDb/TMDB IDs first and only uses title/name fallbacks when unambiguous.
- Rendered movie Trivia as a collapsed section immediately after Cast, with source links on every fact.
- Replaced randomized TMDB-derived actor trivia with the same source-backed trivia pipeline and removed the old shuffle/fact builder.
- Verified with `npm run lint` and `npm run build`.

### 82 — 2026-05-21 — Movie Detail Header Polish

Files: `components/movie/movie-detail-view.tsx`, `progress_nodi.md`

- Moved the title, metadata, watch summary, rating, and tags higher beside the poster.
- Tightened the movie detail header spacing so the library action sits closer to the poster/details group.
- Left the app-wide image cache and prefetch work as the next session.

### 83 — 2026-05-21 — Wikidata Trivia QID Parser Fix

Files: `lib/providers/wikipedia/trivia.ts`, `progress_nodi.md`

- Fixed Wikidata subject resolution by accepting both `http` and `https` entity URLs when extracting QIDs.
- Confirmed the trivia section was empty because SPARQL responses returned `http://www.wikidata.org/entity/Q...` values that the old parser rejected.
- Verified with `npm run lint` and `npm test`.
