import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260528210000_drop_legacy_movie_tables.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("drop legacy movie tables migration", () => {
  it("checks media parity before removing legacy movie tables", () => {
    expect(migrationSql).toContain("Cannot drop legacy movies");
    expect(migrationSql).toContain("Cannot drop legacy provider_mappings");
    expect(migrationSql).toContain("Cannot drop legacy user_movies");
    expect(migrationSql).toContain("Cannot drop legacy user_movie_tags");
    expect(migrationSql).toContain("Cannot drop legacy watch_logs");
  });

  it("removes the watch-log bridge column before dropping watch_logs", () => {
    expect(migrationSql).toContain("drop constraint if exists media_watch_activity_legacy_watch_log_id_fkey");
    expect(migrationSql).toContain("drop column if exists legacy_watch_log_id");
  });

  it("drops legacy RPCs and tables in dependency order", () => {
    expect(migrationSql).toContain("drop function if exists public.apply_movie_watch_state");
    expect(migrationSql).toContain("drop function if exists public.list_library_movies_page");
    expect(migrationSql).toContain(
      "drop trigger if exists sync_last_watched_at_after_watch_log_change on public.watch_logs",
    );

    const orderedDrops = [
      "drop table if exists public.user_movie_tags",
      "drop table if exists public.watch_logs",
      "drop table if exists public.user_movies",
      "drop table if exists public.provider_mappings",
      "drop table if exists public.movie_cast",
      "drop table if exists public.movies",
    ];

    let previousIndex = -1;
    for (const dropStatement of orderedDrops) {
      const nextIndex = migrationSql.indexOf(dropStatement);
      expect(nextIndex).toBeGreaterThan(previousIndex);
      previousIndex = nextIndex;
    }
  });
});
