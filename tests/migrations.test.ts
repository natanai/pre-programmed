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

function applyMigration(database: DatabaseSync, migration: { sql: string }) {
  for (const statement of splitSqlStatements(migration.sql)) database.exec(statement);
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
      for (const migration of migrations) applyMigration(database, migration);

      const meta = database
        .prepare("SELECT schema_version FROM project_meta WHERE id = 1")
        .get() as { schema_version: number } | undefined;
      const latestId = migrations.at(-1)?.id ?? 0;

      expect(meta?.schema_version).toBe(latestId);
    } finally {
      database.close();
    }
  });

  it("migrates legacy compatible equipment slots into equivalent one-slot placements", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const placementMigration = migrations.find((migration) => migration.id === 22);
    expect(placementMigration?.name).toBe("inventory-equipment-placements");

    try {
      for (const migration of migrations.filter((migration) => migration.id < 22)) applyMigration(database, migration);
      database.prepare(
        `INSERT INTO item_definitions (id, key, name, equipment_slot_keys_json)
         VALUES (?, ?, ?, ?)`,
      ).run("legacy-gloves", "legacy_gloves", "Legacy Gloves", '["left","right"]');

      applyMigration(database, placementMigration!);

      const row = database.prepare(
        "SELECT equipment_placements_json FROM item_definitions WHERE id = ?",
      ).get("legacy-gloves") as { equipment_placements_json: string };
      expect(JSON.parse(row.equipment_placements_json)).toEqual([
        { anchorSlotKey: "left", occupiedSlotKeys: ["left"] },
        { anchorSlotKey: "right", occupiedSlotKeys: ["right"] },
      ]);
    } finally {
      database.close();
    }
  });
});
