# Nodi — Bug Log

This file records bugs that were found in production or testing, including root
cause, why tests missed it, and what slowed diagnosis. Use it before
troubleshooting a new issue: the patterns here repeat.

---

## BUG-001 — Newly added movies invisible in /library (2026-05-28)

### Symptom

Movies added via the TMDB detail page appeared in the movie detail view
(`/movie/[id]`) but were not visible in the library (`/library`, `/wishlist`,
or `/media`).

### Root cause

The library reads from `user_media` + `media_items` (new tables). The movie
write path was writing to `user_movies` + `movies` (legacy tables) only. The
`media_items` and `user_media` rows were never created for movies added after
the initial backfill migration (2026-05-26) and before the bridge sync was added
to `ingestPreparedTmdbMovie` / `setMovieWatchStatus` (task 141, 2026-05-28).

The movie detail page reads from the legacy tables, so movies appeared fine
there. The disconnect between write destination and read source created a silent
"half-saved" state.

### Fix

- **Code** (task 141): `ingestPreparedTmdbMovie` now upserts into `media_items`
  with the same UUID; `setMovieWatchStatus` now calls `syncUserMovieToUserMedia`
  to upsert into `user_media`.
- **Data** (migration `20260528130000`): backfills all five new-table joins
  (`media_items`, `media_provider_mappings`, `user_media`, `user_media_tags`,
  `media_watch_activity`) for movies that landed only in the legacy tables.

### Why tests did not catch it

There are no integration tests that write a movie through the full action stack
and then assert it appears in the library query. The two paths (write to legacy,
read from new) are tested in isolation if at all. A single end-to-end test that
calls `markTmdbWatchedAction` and then `listMediaLibraryMoviesPage` on the same
movie ID would have caught this immediately.

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

3. **Missed the timing gap.** The test movies (Super at 09:02, She's the Man at
   09:04) were added before the dev server restarted with the bridge sync code.
   The user confirmed the migration was applied, which ruled out the constraint
   issue, but the timing gap between "code committed" and "server running new
   code" was not considered early enough.

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
