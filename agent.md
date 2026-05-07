# Nodi — Agent Instructions

## Primary rule

Start from `agent.md` and local memory before doing anything substantial in this repo.

When making changes, giving recommendations, or answering repo-specific questions, use this order:
- `agent.md` for repo operating rules
- `docs/product.md` for product scope and behavior
- `docs/reference/architecture.md` for system boundaries and request flow
- `docs/reference/supabase.md` plus `supabase/migrations/` for database and migration rules
- `docs/reference/design.md` for UI direction and interaction tone

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

- Read `agent.md` first, then open only the docs and files needed for the task.
- Use targeted lookup with `rg`/`rg --files`; avoid broad file sweeps unless the task actually needs it.
- Consult first before coding. State the intended approach, key assumptions, and likely files to change, then wait for confirmation before implementing.
- Do not use `git log` or historical archaeology unless the task specifically requires history.
- Never override ignore rules and never force-add ignored files.
- Keep secrets, tokens, local exports, imported watch-history files, and database dumps out of Git. Use `.local/` or `tmp/` for private working data.
- Treat the worktree as user-owned; do not revert unrelated changes.
- For substantial UI exploration, update `mocks.html` first unless the user explicitly wants direct implementation.
- Before changing schema behavior, check `docs/reference/supabase.md` and the existing migration files first.
- Schema changes must be additive through new files in `supabase/migrations/`; do not rewrite an applied migration.

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

- Read `docs/reference/design.md` before any meaningful UI or interaction change.
- Preserve the app’s mobile-first posture; default thinking should optimize for phone widths first.
- Movies and To Watch should stay poster-first rather than drifting into generic table layouts.
- Movie detail should keep hero metadata compact, plot below, and cast presented visually.
- Search results should surface local state like watched or to-watch status when available.
- Sync and settings UI should make connection state, sync health, and last sync time visible.
- Avoid inventing finance-style color semantics, metric framing, or terminology; this app is about movies, viewing history, and personal tracking.

## Response rules for this repo

- When a task is repo-specific, anchor the answer to `agent.md` and the Nodi docs instead of generic advice.
- If a requested change would break one of the product invariants above, call that out directly before implementing.
- When changing schema, mention the migration file and any affected Supabase documentation.
- When changing behavior, keep the relationship between `docs/product.md`, `docs/reference/architecture.md`, and `docs/reference/supabase.md` coherent.
- Default to discussion before implementation, even when the requested code change seems straightforward, unless the user explicitly asks for direct execution.
