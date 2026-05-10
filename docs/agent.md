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
- Read `progress.md` for current local task state before starting assigned work, and update it after
  every assigned task with the outcome, verification, migration notes if any, and commit hash if
  pushed.
- Maintain `progress.md` with only two top-level sections: `# Done` and `# Todo`. Keep the most recent
  entries first, move completed tasks from `Todo` to the top of `Done`, and avoid duplicating the same
  roadmap item in both sections.
- Use targeted lookup with `rg`/`rg --files`; avoid broad file sweeps unless the task actually needs it.
- Do not start routine changes by scanning the whole repo. Use the lookup map below first, then search
  narrowly inside the relevant directory or feature surface.
- Consult first before coding. State the intended approach, key assumptions, and likely files to change, then wait for confirmation before implementing.
- Do not use `git log` or historical archaeology unless the task specifically requires history.
- Never override ignore rules and never force-add ignored files.
- Keep secrets, tokens, local exports, imported watch-history files, and database dumps out of Git. Use `.local/` or `tmp/` for private working data.
- Treat the worktree as user-owned; do not revert unrelated changes.
- For substantial UI exploration, use local mockups inside the `mocks/` folder only — never place mock files in the repo root or elsewhere. The `mocks/` folder is gitignored and must never be committed.
- Before changing schema behavior, check `supabase/db_guide.md` and the existing migration files first.
- Schema changes must be additive through new files in `supabase/migrations/`; do not rewrite an applied migration.

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
| Search UI and API | `components/search/movie-search.tsx`, `app/(shell)/search/page.tsx` | `app/api/search/movies/route.ts`, TMDB adapter/client |
| Remote TMDB detail before ingestion | `app/(shell)/movie/tmdb/[tmdbId]/page.tsx` | `app/(shell)/movie/tmdb/[tmdbId]/tmdb-movie-detail-client.tsx`, `app/(shell)/movie/actions.ts` |
| Local movie detail | `app/(shell)/movie/[movieId]/page.tsx` | `app/(shell)/movie/[movieId]/movie-detail-client.tsx`, `components/movie/movie-detail-view.tsx`, `app/(shell)/movie/[movieId]/actions.ts` |
| Shared movie detail presentation | `components/movie/movie-detail-view.tsx` | `components/movie/overview-text.tsx` |
| Watched Movies page | `app/(shell)/movies/page.tsx` | `components/movie/movie-library-grid.tsx`, `components/movie/poster-card.tsx` |
| To Watch page | `app/(shell)/to-watch/page.tsx` | `components/movie/poster-card.tsx` |
| Poster grid/card behavior | `components/movie/poster-card.tsx`, `components/movie/movie-library-grid.tsx` | `components/search/movie-search.tsx` if search posters are involved |
| Stats page | `app/(shell)/stats/page.tsx` | `lib/db/queries/movies.ts` |
| PWA manifest and icons | `app/manifest.ts`, `public/` | `app/layout.tsx` |
| Design decisions | `docs/design.md` | the component being changed |
| Product or architecture questions | `docs/product.md`, `docs/architecture.md` | `supabase/db_guide.md` for DB-specific questions |
| Progress tracking | `progress.md` | no code lookup unless progress and code disagree |

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
