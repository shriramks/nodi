import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSql = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260526150000_add_media_library_type_filter.sql",
  ),
  "utf8",
);

describe("media library type filter migration", () => {
  it("extends the paged media library RPC with all/movie/show filtering", () => {
    expect(migrationSql).toContain("p_type text default 'all'");
    expect(migrationSql).toContain("when p_type in ('movie', 'show') then p_type");
    expect(migrationSql).toContain("query_options.media_type = 'all'");
    expect(migrationSql).toContain("or mi.type = query_options.media_type");
    expect(migrationSql).toContain("'type', mi.type");
    expect(migrationSql).not.toContain("and mi.type = 'movie'");
  });
});
