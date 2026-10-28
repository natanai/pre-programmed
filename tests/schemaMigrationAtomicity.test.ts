import { describe, expect, it, vi } from "vitest";

type FakeStatement = {
  sql: string;
  params: unknown[];
  run: () => Promise<{ success: true }>;
  all: () => Promise<{ results: Array<{ id: number }> }>;
  bind: (...params: unknown[]) => FakeStatement;
};

function statement(sql: string, appliedIds: number[]): FakeStatement {
  const value: FakeStatement = {
    sql,
    params: [],
    run: vi.fn(async () => ({ success: true as const })),
    all: vi.fn(async () => ({
      results: sql.includes("SELECT id FROM schema_migrations")
        ? appliedIds.map((id) => ({ id }))
        : [],
    })),
    bind: (...params: unknown[]) => {
      value.params = params;
      return value;
    },
  };
  return value;
}

describe("runtime schema migration atomicity", () => {
  it("batches a migration and its schema marker into one D1 transaction", async () => {
    vi.resetModules();
    const appliedIds = Array.from({ length: 44 }, (_, index) => index + 1);
    const prepare = vi.fn((sql: string) => statement(sql, appliedIds));
    const batch = vi.fn(async (_statements: FakeStatement[]) => []);
    const db = { prepare, batch } as unknown as D1Database;
    const { ensureSchema } = await import("../worker/db/schema");

    await ensureSchema(db);

    expect(batch).toHaveBeenCalledTimes(1);
    const statements = batch.mock.calls[0][0] as FakeStatement[];
    expect(statements.some((candidate) => candidate.sql.includes("CREATE TABLE node_openings"))).toBe(true);
    expect(statements.some((candidate) => candidate.sql.includes("ALTER TABLE nodes DROP COLUMN text"))).toBe(true);
    const marker = statements.at(-1);
    expect(marker?.sql).toContain("INSERT INTO schema_migrations");
    expect(marker?.params).toEqual([45, "narrative-node-entry-openings"]);
  });
});
