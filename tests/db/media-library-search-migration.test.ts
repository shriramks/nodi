import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSql = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260905120000_add_library_search_to_rpc.sql",
  ),
  "utf8",
);

describe("media library search migration", () => {
  it("adds server-side title search to the paged media library RPC", () => {
    expect(migrationSql).toContain("p_search text default null");
    expect(migrationSql).toContain("not exists (select 1 from search_tokens)");
    expect(migrationSql).toContain("mi.title not ilike ('%' || st.token || '%')");
    expect(migrationSql).toContain("counted.search_rank asc nulls last");
  });

  it("escapes LIKE metacharacters in the search term", () => {
    expect(migrationSql).toContain("replace(replace(replace(btrim(p_search), '\\', '\\\\'), '%', '\\%'), '_', '\\_')");
  });
});
