import { describe, expect, it } from "vitest";
import { validateMutationBody } from "../worker/validation";
import { inventoryFeaturePersistence } from "../worker/features/inventoryPersistence";
import { mediaFeaturePersistence } from "../worker/features/mediaPersistence";

function recordingDatabase() {
  const sql: string[] = [];
  const database = {
    prepare(statement: string) {
      sql.push(statement);
      const prepared = { bind: () => prepared };
      return prepared;
    },
  } as unknown as D1Database;
  return { database, sql };
}

describe("feature-owned Worker delete mutations", () => {
  it("accepts item and synth deletion through the same validation catalog as the client", () => {
    for (const type of ["item.delete", "synth.delete"] as const) {
      expect(validateMutationBody({
        expectedRevision: 1,
        description: `Delete ${type}`,
        operations: [{ type, id: "resource-id" }],
      })).toBeNull();
      expect(validateMutationBody({
        expectedRevision: 1,
        description: `Delete ${type}`,
        operations: [{ type, id: "" }],
      })).toMatch(/id is required/i);
    }
  });

  it("cleans item hooks/loadouts and deletes synth rows in durable storage", () => {
    const inventory = recordingDatabase();
    const itemStatements = inventoryFeaturePersistence.mutationStatements(inventory.database, { type: "item.delete", id: "item" });
    expect(itemStatements).toHaveLength(3);
    expect(inventory.sql.join("\n")).toContain("DELETE FROM operation_hooks");
    expect(inventory.sql.join("\n")).toContain("json_each");
    expect(inventory.sql.join("\n")).toContain("DELETE FROM item_definitions");

    const media = recordingDatabase();
    const synthStatements = mediaFeaturePersistence.mutationStatements(media.database, { type: "synth.delete", id: "sound" });
    expect(synthStatements).toHaveLength(1);
    expect(media.sql[0]).toContain("DELETE FROM synth_sounds");
  });
});
