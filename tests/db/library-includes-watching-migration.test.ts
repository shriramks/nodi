import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSql = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20261002140000_library_includes_watching_status.sql"),
  "utf8",
);

describe("library includes watching migration", () => {
  it("matches done, stopped and watching for the watched bucket", () => {
    expect(migrationSql).toContain("um.status in ('done', 'stopped', 'watching')");
  });

  it("keeps the search support from the previous definition", () => {
    expect(migrationSql).toContain("p_search text default null");
  });
});
