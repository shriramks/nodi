import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSql = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260526130000_add_media_library_movies_page_rpc.sql",
  ),
  "utf8",
);

describe("media library movies page migration", () => {
  it("adds a media-backed route-compatible movie library RPC", () => {
    expect(migrationSql).toContain("create or replace function public.list_media_library_movies_page");
    expect(migrationSql).toContain("from public.user_media um");
    expect(migrationSql).toContain("join public.media_items mi");
    expect(migrationSql).toContain("and mi.type = 'movie'");
    expect(migrationSql).toContain("from public.media_watch_activity mwa");
    expect(migrationSql).toContain("from public.user_media_tags umat");
    expect(migrationSql).toContain("when counted.status = 'wishlist' then 'to_watch'");
  });
});
