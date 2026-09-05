# Nodi — Bug Log

This file records bugs that were found in production or testing, including root
cause, why tests missed it, and what slowed diagnosis. Use it before
troubleshooting a new issue: the patterns here repeat.

---

## BUG-001 — Newly added movies invisible in /library (2026-05-28)

**Issue:** Movies added via the TMDB detail page appeared in the movie detail view (`/movie/[id]`) but were not visible in the library (`/library`, `/wishlist`, or `/media`).

**Expected:** A movie added via the detail page should appear immediately in the library.

**Actual:** The movie showed correctly on its detail page but was absent from all library views.

**Root cause:** The library reads from `user_media` + `media_items` (new tables). The movie write path was writing to `user_movies` + `movies` (legacy tables) only. The `media_items` and `user_media` rows were never created for movies added after the initial backfill migration (2026-05-26) and before the bridge sync was added to `ingestPreparedTmdbMovie` / `setMovieWatchStatus`. The movie detail page reads from the legacy tables, so movies appeared fine there. The disconnect between write destination and read source created a silent "half-saved" state.

**Why missed:** Investigation started with reading application code. The code looked correct because the bridge sync had been added. The real evidence — querying Supabase directly to confirm the rows were or were not there — came much later. Additionally, the test movies were added before the dev server restarted with the bridge sync code; the timing gap between "code committed" and "server running new code" was not considered early enough.

**Future points to keep in mind:**
- Query the DB first when something is missing from a view. Two API calls to `user_media` and `media_items` would have confirmed the split immediately.
- When a write path and read path use different tables, any new write that only touches one side creates a silent half-saved state. Check both tables before concluding the write worked.
- After deploying code that changes a write path, confirm the running server is actually on the new code before testing. Server restart timing gaps cause phantom "code is correct but behavior is wrong" confusion.
- A single end-to-end test that writes through the full action stack and reads from the library query would catch this class of bug immediately.

---

## BUG-002 — Episodes page crash: "Something went wrong" on shows in watching/auto_all_aired state (2026-05-29)

**Issue:** Navigating to `/show/[showId]/episodes` for any show with `status=watching` or `completion_mode=auto_all_aired` crashed the page with a generic "Something went wrong" error. The error persisted across multiple attempted fixes over several sessions.

**Expected:** The episodes page loads and displays all episodes with watch state.

**Actual:** Page crashed immediately. No episode list was accessible. The browser console showed a non-specific error with no indication of which code path failed.

**Root cause (actual, final):** `ShowEpisodeListView` is a Client Component (`"use client"`). The episodes page (a Server Component) was passing `episodeWatchControl` and `seasonWatchControl` as render-prop functions to it. React forbids passing arbitrary functions from Server Components to Client Components across the server/client boundary. This caused the component serialization to fail on every render.

This was a pre-existing architectural violation. It surfaced as a crash when the overall show page refactoring (tasks 151–153) changed what was on the render path, making the serialization error the active failure mode.

**Why missed across multiple sessions:**

1. **Wrong hypothesis anchored all early work.** The first crash was a DB write failure during render (`refreshShowWatchedState` writing to Supabase in the server component render path). That was real and fixed (151-A, 152, 153). But the session then assumed that fixing the DB write would fix the crash entirely. It did not, because there was a second independent crash — the function-as-prop violation — that had always been there.

2. **No server logs were read until late.** The error shown in the browser ("Something went wrong", "Functions cannot be passed directly to Client Components") was present the whole time but dismissed as too vague to act on. The actual React error message is specific and actionable — it names the prop and the component. Reading server/browser logs first rather than code would have identified this in the first session.

3. **Diagnostic logging was added too late and too shallowly.** When logging was finally added (commit `c686fe2`), it was placed inside DB query functions — the wrong layer for this error. The function-as-prop violation throws during React's serialization step, before any query runs. The correct place to instrument was the render boundary itself, not the DB layer.

4. **Each fix was assumed to be the final fix without verifying the actual running behavior.** Commits were pushed with the belief that they resolved the issue, but local verification (loading the page in the running dev server and reading the terminal output) was not done until much later. The real error was visible in the dev server log but not checked.

5. **The dev server log file was misread.** The log at `.next/dev/logs/next-development.log` contained the exact error message but was initially read as "old entries." Timestamps in that log file are elapsed time since server start, not wall-clock time, which caused confusion about when errors occurred.

**What finally helped:**

Reading the actual browser error message that the user shared: `"Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'"`. This is a React-level error that names the prop (`episodeWatchControl`) and the component directly. All the DB-level logging and query analysis was irrelevant — the crash happened before any query ran.

**Future points to keep in mind:**
- When an error says "Something went wrong," the first action is to read the actual server or browser error text, not to read code. The actionable error is always one layer down from the generic message.
- In Next.js App Router, a Server Component cannot pass a function as a prop to a Client Component. This includes render props and callbacks. The allowed patterns are: (a) pass Server Actions (they are serializable), (b) pass pre-rendered `ReactNode` as children/slots, (c) move the interactive logic inside the client component.
- If a page crashes and the fix is "remove a write from the render path," verify the page actually loads after the fix before closing the task. Do not assume the crash is fully explained by one root cause.
- The dev server log at `.next/dev/logs/next-development.log` uses elapsed-time timestamps (not wall clock). The most recent entries are at the bottom. Read it directly rather than inferring from file modification time.
- Adding logging to DB query layers is not useful for React serialization errors. For crashes in the render/serialization phase, the React error boundary output and the browser console error are the right diagnostic surface.

---

## BUG-003 — New season of an existing show never appears; mixed-batch episode upsert nulls `id` (2026-09-04, corrected 2026-09-05)

**Issue:** A show already in the library that gains a new season on TMDB (Reacher S4) never showed that season. The season list stopped at the last previously-synced season, there were no rows to mark watched, and tapping **Resume** appeared to do nothing.

**Expected:** Opening the show or its Episodes page re-syncs from TMDB; the new season's episodes appear and are markable.

**Actual:** Season absent across many reloads. Repeated Resume taps had no visible effect. A first fix (a migration restoring `episodes.id`'s `DEFAULT`) was applied and confirmed to run, but the exact same failure recurred on the very next sync attempt, with an identical Postgres error.

**Root cause — three stacked failures:**

1. **The real bug: a heterogeneous-key batch upsert silently nulls a missing column instead of using its DEFAULT.** `ingestPreparedTmdbShow` builds one `episodeRows` array covering every season being synced, and only set `id` on rows it already knew about (via a TMDB provider-mapping lookup) — new episodes omitted the key entirely. For a show gaining a season, that one array mixes rows *with* `id` (the existing seasons) and rows *without* it (the new one). PostgREST/Postgres builds those rows with `json_populate_recordset`, which fills a JSON object's **missing** keys with `NULL`, not the column's `DEFAULT` — that behavior only kicks in when a key is entirely absent from the object, so it's invisible on a fully-new show (every row omits `id` uniformly, and a single-statement `INSERT` without an `id` column genuinely does use the DEFAULT) and only bites the very case that matters here: an *existing* show gaining episodes. This is why applying migration `20260904140000_fix_episodes_id_default.sql` (below) did not fix anything — the DEFAULT was never being consulted for this call in the first place.
2. **Schema hygiene, real but secondary:** `episodes.id` and `media_items.id` also had their `DEFAULT gen_random_uuid()` re-asserted as a defensive measure (they should have it regardless, and the Trakt episode sync path — which *does* upsert a uniform all-omit-`id` batch — genuinely depends on it). Whether the DEFAULT was actually missing in production or this was chasing a red herring off the first `23502` was never independently confirmed via `information_schema` before writing the migration; the SQLSTATE happens to be identical whether the DEFAULT is missing or PostgREST nulled the field itself, so the log alone couldn't distinguish the two causes. The migration draft also incorrectly targeted `media_provider_mappings.id` without checking that table's schema — it has no `id` column at all, PK is the composite `(provider, provider_media_type, provider_id)` — which failed with `42703` and was dropped.
3. **The failure was invisible and unrecoverable from the UI.** `hydrateShowEpisodesOnDemand` catches the ingest error, `console.error`s it, and returns `false`; the page then renders normally with stale data. No user-facing error, and no manual "refresh from TMDB" affordance — so the only way to retry was a code change. Separately, `isShowDone()` on the show page recomputes "done" from locally-known episodes, so with the new season missing it forced the action bar to show Resume/Remove even though `user_media.status` was already `watching` — making Resume look broken.

**Why diagnosis was slow (two rounds):**

- Repeated the BUG-001 / BUG-002 pattern: theorized from application code (the hydration gate, the 3-day staleness window, the `status === "watching"` guard) for several rounds instead of reading the server log first. The log named the SQLSTATE and the failing row immediately.
- **Stopped one layer too early.** A missing column `DEFAULT` was a plausible, sufficient explanation for `null value in column "id"` and was never independently verified against `information_schema` before being treated as the fix — the identical error after a confirmed-successful migration run was the actual disproof, and it took a second round (and the user re-fetching the same log) to notice the fix hadn't changed the failure at all.
- The mixed-batch nature of the bug is easy to miss by inspection: `episodeInsert()` reads correctly in isolation (existing episodes keep their id, new ones omit it) — the defect is only visible one level up, in how a *single* omit-vs-set-key array gets serialized to Postgres, which has nothing to do with SQL and doesn't show up unless you know the `json_populate_recordset` NULL-vs-DEFAULT distinction.
- `ingestPreparedTmdbShow` upserts `media_items` (bumping `metadata_updated_at` and `episode_count`) *before* the episode insert in the same function, so a failed hydration still moved those columns — muddying "is it even trying?" reasoning.

**Fixes:**

- `lib/db/mutations/media.ts` (`ingestPreparedTmdbShow`) — every episode row now gets an explicit `id`: the real existing id when one is found (by TMDB provider mapping, or falling back to a direct `(show_id, season_number, episode_number)` lookup for rows with no mapping yet, e.g. minimal episodes from Trakt), otherwise a fresh `crypto.randomUUID()`. No row in the batch ever omits `id`, so the heterogeneous-array NULL-fill can't happen, and no existing row's id is ever reassigned.
- `supabase/migrations/20260904140000_fix_episodes_id_default.sql` — re-assert `default gen_random_uuid()` on `episodes.id` and `media_items.id` regardless, since the Trakt minimal-episode sync path does rely on it and it's correct schema hygiene either way.
- Loud + recoverable path: an explicit **Check for new episodes** action that force re-ingests (bypasses the staleness gate) and shows the real error. Show-page action state now trusts `user_media.status` instead of the recomputed `isShowDone`.

**Future points to keep in mind:**

- **Read the server/runtime log before theorizing — and don't stop at the first plausible cause.** A `23502` with the failing row narrows down *where* it broke, not *why*; "column has no DEFAULT" and "DEFAULT exists but was never consulted" produce byte-identical Postgres errors. Verify a schema-level hypothesis against `information_schema` (or by testing the same insert shape directly) before calling it the fix, especially when the write path goes through an array/batch upsert.
- **A "fix" is not confirmed until the original failing action succeeds, not just until the code you changed runs without its own error.** The migration ran cleanly — that confirmed the SQL was valid, not that it resolved the bug. The proof needed was a second, independent Reacher sync attempt.
- Supabase/PostgREST bulk insert or upsert calls: never send an array of objects with inconsistent key sets when relying on column `DEFAULT`s. Give every row in a batch the same keys — resolve or generate values in application code rather than leaning on the database to fill gaps, since the database's gap-filling behavior for JSON-sourced rows is NULL, not DEFAULT.
- After any manual change in the Supabase SQL editor, or a DB restore / branch / dump-reload, verify column **defaults and constraints**, not just that tables and columns exist. `CREATE TABLE AS`, `pg_dump` variants, and dashboard edits can silently drop a `DEFAULT`. A schema-assertion check (compare live `information_schema.columns` against a manifest) run in CI or on boot would catch the next one.
- A server-side write path that depends on a DB-generated value should fail **loudly and recoverably** — never `catch → console.error → return false` for a data-integrity error the user is actively waiting on. Always leave a retry affordance in the UI.
- Ingestion that partially writes (`media_items` updated, `episodes` failed) leaves misleading state. Either wrap the show + episode writes in one transactional RPC, or write episodes before bumping `metadata_updated_at` / `episode_count`.
- Don't let a client-side recomputation override an explicit persisted status (`isShowDone` vs `user_media.status`). If the computed state is meant to be authoritative, write it back — already an AGENT.md rule.

---

## BUG-001 history note

### Why diagnosis took longer than it should have

1. **Read code before reading data.** The investigation started with reading
   application code (`ingestPreparedTmdbMovie`, `setMovieWatchStatus`,
   `syncUserMovieToUserMedia`, the RPC). The code looked correct because the
   bridge sync *had* been added. The real evidence — querying Supabase directly
   to confirm the rows were or were not there — came much later. Querying the DB
   first would have confirmed the split (`movies` ✓, `media_items` ✗) in two
   API calls.

2. **Over-indexed on failure mode instead of data state.** Once the code path
   appeared correct, diagnosis chased abstract failure modes (migration not
   applied, constraint violation, RLS blocking, silent upsert, admin key wrong)
   rather than verifying the actual DB state at each step of the write chain.

3. **Missed the timing gap.** The test movies were added before the dev server
   restarted with the bridge sync code. The user confirmed the migration was
   applied, which ruled out the constraint issue, but the timing gap between
   "code committed" and "server running new code" was not considered early enough.

### Troubleshooting checklist for similar bugs (library not showing X)

1. Query `user_media` for the missing item's UUID. If absent, the write path
   failed to populate the new table.
2. Query `media_items` for the same UUID. If absent, `ingestPreparedTmdbMovie`
   did not write there (or used a different ID).
3. Query the legacy table (`user_movies`, `movies`) for the same UUID. If
   present there but absent in the new tables, the bridge sync was missing or
   failed.
4. Only after confirming the data state, read the code for the specific function
   that should have written the missing row.
