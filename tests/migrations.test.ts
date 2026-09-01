import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { executeSqlScript, MIGRATION_SCRIPTS, splitSqlStatements } from "../worker/db/migrations";

describe("D1 migration scripts", () => {
  it("keeps multi-line statements intact for D1 prepared execution", () => {
    const statements = splitSqlStatements(`
      CREATE TABLE example (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT INTO example (id, value)
      VALUES ('one', 'two');
    `);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("value TEXT NOT NULL\n      )");
    expect(statements[1]).toContain("VALUES ('one', 'two')");
  });

  it("executes each complete statement instead of sending a line-oriented exec script", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const prepare = vi.fn(() => ({ run }));
    const database = { prepare } as unknown as D1Database;

    await executeSqlScript(database, "CREATE TABLE one (id TEXT);\nCREATE TABLE two (id TEXT);");

    expect(prepare.mock.calls.map(([sql]) => sql)).toEqual([
      "CREATE TABLE one (id TEXT)",
      "CREATE TABLE two (id TEXT)",
    ]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("applies every migration to a fresh SQLite database", () => {
    const database = new DatabaseSync(":memory:");
    try {
      for (const migration of MIGRATION_SCRIPTS) {
        for (const statement of splitSqlStatements(migration.sql)) database.exec(statement);
      }
      const version = database.prepare("SELECT schema_version FROM project_meta WHERE id = 1").get() as { schema_version: number };
      const hookTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'operation_hooks'").get() as { sql: string } | undefined;
      const oldHookTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_operation_hooks'").get();
      const entityColumns = database.prepare("PRAGMA table_info(entity_definitions)").all() as Array<{ name: string }>;
      const outcomeColumns = database.prepare("PRAGMA table_info(interaction_outcomes)").all() as Array<{ name: string }>;

      expect(version.schema_version).toBe(12);
      expect(hookTable?.sql).toContain("target_kind TEXT NOT NULL");
      expect(hookTable?.sql).not.toContain("target_kind IN");
      expect(oldHookTable).toBeUndefined();
      expect(entityColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
        "operation_interactable",
        "operations_json",
      ]));
      expect(outcomeColumns.map((column) => column.name)).toContain("response_speaker_id");
    } finally {
      database.close();
    }
  });
});
