import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260526110000_backfill_movie_media_tables.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("movie media backfill migration", () => {
  it("preserves movie ids as media ids and user movie ids as user media ids", () => {
    expect(migrationSql).toMatch(/insert into public\.media_items\s*\(\s*id,/);
    expect(migrationSql).toMatch(/select\s+id,\s+'movie'/);
    expect(migrationSql).toMatch(/insert into public\.user_media\s*\(\s*id,/);
    expect(migrationSql).toMatch(/select\s+id,\s+user_id,\s+movie_id,/);
  });

  it("maps existing movie watchlist state to media wishlist state", () => {
    expect(migrationSql).toContain("when status = 'to_watch' then 'wishlist'");
    expect(migrationSql).toContain("when status = 'watched' then 'manual'");
  });

  it("checks row and key parity for copied movie, state, tag, and provider rows", () => {
    expect(migrationSql).toContain("Movie media backfill missing % media_items rows.");
    expect(migrationSql).toContain(
      "Movie media backfill missing or mismatched % user_media rows.",
    );
    expect(migrationSql).toContain(
      "Movie media backfill missing or mismatched % user_media_tags rows.",
    );
    expect(migrationSql).toContain(
      "Movie media backfill missing or mismatched % TMDB provider mappings.",
    );
  });
});
