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

function applyMigration(database: DatabaseSync, sql: string) {
  for (const statement of splitSqlStatements(sql)) database.exec(statement);
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
      for (const migration of migrations) applyMigration(database, migration.sql);

      const meta = database
        .prepare("SELECT schema_version FROM project_meta WHERE id = 1")
        .get() as { schema_version: number } | undefined;
      const latestId = migrations.at(-1)?.id ?? 0;

      expect(meta?.schema_version).toBe(latestId);
    } finally {
      database.close();
    }
  });

  it("turns legacy exposed State values into ordinary Status-group membership", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const statePresentationMigration = migrations.find((migration) => migration.id === 29);
    expect(statePresentationMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 29)) {
        applyMigration(database, migration.sql);
      }

      database.exec(`
        INSERT INTO variable_definitions (id, key, label, value_type, initial_json, show_in_status)
        VALUES ('visible-value', 'health', 'Health', 'number', '100', 1);
        INSERT INTO variable_definitions (id, key, label, value_type, initial_json, show_in_status)
        VALUES ('internal-value', 'secret', 'Secret', 'number', '7', 0);
        INSERT INTO computed_definitions (id, key, label, source, format, show_in_status)
        VALUES ('visible-computed', 'elapsed', 'Elapsed', 'elapsed_seconds', 'integer', 1);
      `);

      applyMigration(database, statePresentationMigration!.sql);

      const groups = database.prepare("SELECT id, label FROM state_groups ORDER BY order_index, id").all() as unknown as {
        id: string;
        label: string;
      }[];
      const variables = database.prepare("SELECT id, player_group_id FROM variable_definitions ORDER BY id").all() as unknown as {
        id: string;
        player_group_id: string | null;
      }[];
      const computed = database.prepare("SELECT player_group_id FROM computed_definitions WHERE id = 'visible-computed'").get() as {
        player_group_id: string | null;
      } | undefined;

      expect(groups).toEqual([{ id: "legacy-status", label: "Status" }]);
      expect(variables).toEqual([
        { id: "internal-value", player_group_id: null },
        { id: "visible-value", player_group_id: "legacy-status" },
      ]);
      expect(computed?.player_group_id).toBe("legacy-status");
    } finally {
      database.close();
    }
  });
});
