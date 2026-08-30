import { describe, expect, it } from "vitest";
import { collectD1Backup, type BackupDatabase } from "../worker/backup";
import { handleApi, type Env } from "../worker/index";

describe("canonical D1 backup", () => {
  it("rejects an unauthenticated backup before touching the database", async () => {
    const response = await handleApi(new Request("https://example.test/api/author/backup"), { DB: {} as D1Database, ADMIN_KEY: "private" });
    expect(response.status).toBe(401);
  });

  it("enumerates every current and future non-internal table automatically", async () => {
    const schema = [
      { type: "table", name: "nodes", tbl_name: "nodes", sql: "CREATE TABLE nodes(id TEXT)" },
      { type: "table", name: "future_table", tbl_name: "future_table", sql: "CREATE TABLE future_table(id TEXT)" },
      { type: "table", name: "_cf_METADATA", tbl_name: "_cf_METADATA", sql: "CREATE TABLE _cf_METADATA(key TEXT)" },
    ];
    const rows: Record<string, unknown[]> = { nodes: [{ id: "a" }], future_table: [{ id: "future" }] };
    const db = {
      prepare(sql: string) {
        return {
          async all() {
            if (sql.includes("sqlite_master")) return { results: schema };
            const table = sql.match(/FROM\s+"([^"]+)"/)?.[1] ?? "";
            return { results: rows[table] ?? [] };
          },
        };
      },
    } as unknown as BackupDatabase;
    const backup = await collectD1Backup(db, "2026-08-30T00:00:00.000Z");
    expect(Object.keys(backup.tables)).toEqual(["nodes", "future_table"]);
    expect(backup.tables.future_table).toEqual([{ id: "future" }]);
    expect(backup.schema).toEqual(schema.slice(0, 2));
  });
});
