import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260526120000_add_media_watch_activity.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("media watch activity migration", () => {
  it("adds a generalized activity table linked to media, episodes, and legacy watch logs", () => {
    expect(migrationSql).toContain("create table public.media_watch_activity");
    expect(migrationSql).toContain("media_id uuid not null references public.media_items(id)");
    expect(migrationSql).toContain("episode_id uuid null references public.episodes(id)");
    expect(migrationSql).toContain(
      "legacy_watch_log_id uuid null unique references public.watch_logs(id)",
    );
  });

  it("adds the expected date indexes for user and media reads", () => {
    expect(migrationSql).toContain("media_watch_activity_user_watched_at_desc_idx");
    expect(migrationSql).toContain(
      "on public.media_watch_activity (user_id, watched_at desc)",
    );
    expect(migrationSql).toContain("media_watch_activity_media_watched_at_desc_idx");
    expect(migrationSql).toContain(
      "on public.media_watch_activity (media_id, watched_at desc)",
    );
  });

  it("backfills movie watch logs through movie media items without adding watch-log triggers", () => {
    expect(migrationSql).toMatch(/select\s+wl\.id,\s+wl\.user_id,\s+wl\.movie_id,/);
    expect(migrationSql).toContain("join public.media_items mi");
    expect(migrationSql).toContain("and mi.type = 'movie'");
    expect(migrationSql).not.toMatch(/create\s+trigger/i);
  });

  it("checks row parity between legacy movie logs and media activity rows", () => {
    expect(migrationSql).toContain(
      "Media watch activity backfill missing or mismatched % movie watch log rows.",
    );
    expect(migrationSql).toContain(
      "Media watch activity backfill found % legacy rows without movie media items.",
    );
  });
});
