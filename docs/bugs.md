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

## BUG-003 — New season of an existing show never appears; episode ingest fails on missing `episodes.id` default (2026-09-04)

**Issue:** A show already in the library that gains a new season on TMDB (Reacher S4) never showed that season. The season list stopped at the last previously-synced season, there were no rows to mark watched, and tapping **Resume** appeared to do nothing.

**Expected:** Opening the show or its Episodes page re-syncs from TMDB; the new season's episodes appear and are markable.

**Actual:** Season absent across many reloads. Repeated Resume taps had no visible effect. The real failure only surfaced after reading the Vercel runtime log.

**Root cause — two stacked failures:**

1. **Schema drift in production.** `episodes.id` had lost its `DEFAULT gen_random_uuid()`. Migration `20260526100000_add_media_schema_foundation.sql:48` defines it, but the live DB no longer had the default (PRIMARY KEY / NOT NULL still intact — only the default gone, consistent with a manual table recreation or a dump/restore that dropped column defaults). `ingestPreparedTmdbShow` and the Trakt episode sync both omit `id` on insert and rely on the default, so every new-episode insert failed with `null value in column "id" of relation "episodes" violates not-null constraint` (SQLSTATE `23502`). The existing S1–S3 rows were written while the default still existed.
2. **The failure was invisible and unrecoverable from the UI.** `hydrateShowEpisodesOnDemand` catches the ingest error, `console.error`s it, and returns `false`; the page then renders normally with stale data. No user-facing error, and no manual "refresh from TMDB" affordance — so the only way to retry was a code change. Separately, `isShowDone()` on the show page recomputes "done" from locally-known episodes, so with the new season missing it forced the action bar to show Resume/Remove even though `user_media.status` was already `watching` — making Resume look broken.

**Why diagnosis was slow:**

- Repeated the BUG-001 / BUG-002 pattern: theorized from application code (the hydration gate, the 3-day staleness window, the `status === "watching"` guard) for several rounds instead of reading the server log first. The log named the SQLSTATE and the failing row immediately.
- The staleness gate was a red herring that absorbed attention — `needsShowEpisodeHydration` was actually returning `true` and the ingest *was* running; the failure was one layer down, in the DB write.
- `ingestPreparedTmdbShow` upserts `media_items` (bumping `metadata_updated_at` and `episode_count`) *before* the episode insert in the same function, so a failed hydration still moved those columns — muddying "is it even trying?" reasoning.

**Fixes:**

- `supabase/migrations/20260904140000_fix_episodes_id_default.sql` — re-assert `default gen_random_uuid()` on `episodes.id`, and defensively on `media_items.id` and `media_provider_mappings.id`.
- Loud + recoverable path: surface hydration/ingest failure on the show + Episodes pages, plus an explicit **Check for new episodes** action that force re-ingests (bypasses the staleness gate) and shows the real error. Show-page action state now trusts `user_media.status` instead of the recomputed `isShowDone`.

**Future points to keep in mind:**

- **Read the server/runtime log before theorizing.** Third time this exact lesson has cost multiple rounds. A `23502` with the failing row is unambiguous and points straight at the layer that failed.
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
