import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSql = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20261002120000_library_excludes_watching_status.sql"),
  "utf8",
);

describe("library excludes watching migration", () => {
  it("matches only done and stopped for the watched bucket", () => {
    expect(migrationSql).toContain("um.status in ('done', 'stopped')");
    expect(migrationSql).not.toContain("'stopped', 'watching'");
  });

  it("keeps the search support from the previous definition", () => {
    expect(migrationSql).toContain("p_search text default null");
  });
});
