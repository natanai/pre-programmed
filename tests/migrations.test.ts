import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { executeSqlScript, MIGRATION_SCRIPTS, splitSqlStatements } from "../worker/db/migrations";
import { WORKER_FEATURE_PERSISTENCE } from "../worker/features/catalog";

function currentMigrations() {
  return [
    ...MIGRATION_SCRIPTS,
    ...WORKER_FEATURE_PERSISTENCE.flatMap((feature) => feature.migrations ?? []),
  ].sort((left, right) => left.id - right.id);
}

describe("D1 migration safety", () => {
  it("keeps multi-line statements intact for prepared execution", () => {
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

  it("executes complete statements instead of a line-oriented script", async () => {
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

  it("keeps composed migration ids unique", () => {
    const migrations = currentMigrations();
    const ids = migrations.map((migration) => migration.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
  });

  it("applies the complete current migration catalog to an empty database", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();

    try {
      for (const migration of migrations) {
        for (const statement of splitSqlStatements(migration.sql)) database.exec(statement);
      }

      const meta = database
        .prepare("SELECT schema_version FROM project_meta WHERE id = 1")
        .get() as { schema_version: number } | undefined;
      const latestId = migrations.at(-1)?.id ?? 0;

      expect(meta?.schema_version).toBe(latestId);
    } finally {
      database.close();
    }
  });
});
