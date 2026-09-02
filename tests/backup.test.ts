import { describe, expect, it } from "vitest";
import { collectD1Backup, collectProjectBackup, type BackupDatabase } from "../worker/backup";
import { handleApi } from "../worker/index";

function backupDatabase() {
  const schema = [
    { type: "table", name: "nodes", tbl_name: "nodes", sql: "CREATE TABLE nodes(id TEXT)" },
    { type: "table", name: "future_table", tbl_name: "future_table", sql: "CREATE TABLE future_table(id TEXT)" },
    { type: "table", name: "_cf_METADATA", tbl_name: "_cf_METADATA", sql: "CREATE TABLE _cf_METADATA(key TEXT)" },
  ];
  const rows: Record<string, unknown[]> = { nodes: [{ id: "a" }], future_table: [{ id: "future" }] };
  return {
    database: {
      prepare(sql: string) {
        return {
          async all() {
            if (sql.includes("sqlite_master")) return { results: schema };
            const table = sql.match(/FROM\s+"([^"]+)"/)?.[1] ?? "";
            return { results: rows[table] ?? [] };
          },
        };
      },
    } as unknown as BackupDatabase,
    schema,
  };
}

describe("canonical project backup", () => {
  it("rejects an unauthenticated backup before touching storage", async () => {
    const response = await handleApi(new Request("https://example.test/api/author/backup"), { DB: {} as D1Database, ADMIN_KEY: "private" });
    expect(response.status).toBe(401);
  });

  it("enumerates every current and future non-internal D1 table automatically", async () => {
    const { database, schema } = backupDatabase();
    const backup = await collectD1Backup(database, "2026-08-30T00:00:00.000Z");
    expect(Object.keys(backup.tables)).toEqual(["nodes", "future_table"]);
    expect(backup.tables.future_table).toEqual([{ id: "future" }]);
    expect(backup.schema).toEqual(schema.slice(0, 2));
  });

  it("includes immutable R2 Media objects alongside relational project state", async () => {
    const { database } = backupDatabase();
    const content = new TextEncoder().encode("media bytes");
    const bucket = {
      async list() {
        return { objects: [{ key: "media/content_one" }], truncated: false };
      },
      async get(key: string) {
        if (key !== "media/content_one") return null;
        return {
          httpMetadata: { contentType: "application/octet-stream" },
          async arrayBuffer() { return content.buffer; },
        };
      },
    } as unknown as R2Bucket;

    const backup = await collectProjectBackup(database, bucket, "2026-09-02T00:00:00.000Z");
    expect(backup).toMatchObject({
      format: "pre-programmed-project-backup",
      version: 2,
      exportedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(backup.database.tables.nodes).toEqual([{ id: "a" }]);
    expect(backup.mediaObjects).toEqual([{
      key: "media/content_one",
      contentType: "application/octet-stream",
      dataBase64: "bWVkaWEgYnl0ZXM=",
    }]);
  });
});
