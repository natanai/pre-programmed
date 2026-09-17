import { describe, expect, it } from "vitest";
import { normalizeProjectSnapshot } from "../src/engine/project/settings";
import { collectD1Backup, collectProjectBackup, type BackupDatabase } from "../worker/backup";
import { handleApi } from "../worker/index";
import { migratePortableProject } from "../worker/portableProject";
import { project } from "./fixtures";

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

  it("backs up all D1-authored state while identifying file Media as repository-owned", async () => {
    const { database } = backupDatabase();
    const backup = await collectProjectBackup(database, "2026-09-02T00:00:00.000Z");
    expect(backup).toMatchObject({
      format: "pre-programmed-project-backup",
      version: 3,
      exportedAt: "2026-09-02T00:00:00.000Z",
      repositoryMedia: "version-controlled",
    });
    expect(backup.database.tables.nodes).toEqual([{ id: "a" }]);
  });

  it("keeps the portable project document platform-neutral and strips legacy run bookmarks", () => {
    const snapshot = project({ revision: 42 });
    const { revision: _revision, ...portableSnapshot } = snapshot;
    const document = migratePortableProject({
      format: "pre-programmed-project",
      version: 1,
      exportedAt: "2026-09-04T00:00:00.000Z",
      sourceSchemaVersion: snapshot.schemaVersion,
      project: portableSnapshot,
      bookmarks: [],
      featureData: {},
    });
    const normalized = normalizeProjectSnapshot({ ...portableSnapshot, revision: 0 });
    const { revision: _normalizedRevision, ...normalizedPortable } = normalized;

    expect(document.version).toBe(3);
    expect(document.project).toEqual(normalizedPortable);
    expect(document).not.toHaveProperty("bookmarks");
    expect(JSON.stringify(document)).not.toMatch(/workers\.dev|cloudflare|PORTABLE_EXECUTABLE_DIR|database_id|account_id|natanai/i);
  });

  it("migrates portable v2 Node prose and destination ids into canonical entry responses", () => {
    const snapshot = project({ revision: 42 });
    const { revision: _revision, ...portableSnapshot } = snapshot;
    const performance = { charactersPerSecond: 23, cues: [] };
    const dialoguePerformance = { charactersPerSecond: 17, cues: [] };
    const legacyProject = {
      ...portableSnapshot,
      schemaVersion: 44,
      nodes: [
        {
          id: "a",
          nodeNumber: 1,
          text: "Do you have a question?",
          dialogueText: "Ask away.",
          ending: false,
          tags: [],
          locationId: null,
          locationMode: "continue",
          conversationCharacterId: null,
          conversationMode: "continue",
          anchor: { mode: "continue", text: "" },
          entryEffects: [],
          performance,
          dialoguePerformance,
        },
        {
          id: "b",
          nodeNumber: 2,
          text: "Anything else?",
          dialogueText: "",
          ending: false,
          tags: [],
          locationId: null,
          locationMode: "continue",
          conversationCharacterId: null,
          conversationMode: "continue",
          anchor: { mode: "continue", text: "" },
          entryEffects: [],
          performance,
          dialoguePerformance,
        },
      ],
      interactions: [{
        id: "ask-again",
        sourceNodeId: "a",
        order: 0,
        wording: "again",
        matchMode: "command",
        choiceVisibility: "prompt",
        choiceVisibleWhen: { type: "always" },
        aliases: ["again"],
        tags: [],
        notes: "",
        outcomes: [{
          id: "ask-again-default",
          order: 0,
          label: "default",
          authorStatus: "configured",
          condition: { type: "always" },
          responseText: "",
          dialogueText: "",
          speakerId: null,
          responsePerformance: performance,
          dialoguePerformance,
          effects: [],
          disposition: "transition",
          destinationNodeId: "b",
        }],
      }],
    };

    const document = migratePortableProject({
      format: "pre-programmed-project",
      version: 2,
      exportedAt: "2026-09-15T00:00:00.000Z",
      sourceSchemaVersion: 44,
      project: legacyProject,
      featureData: {},
    });

    expect(document.version).toBe(3);
    expect(document.project.nodes[0]).not.toHaveProperty("text");
    expect(document.project.nodes[0]).not.toHaveProperty("dialogueText");
    expect(document.project.nodes[0].openings).toEqual([{
      id: "node-opening:a:default",
      order: 0,
      condition: { type: "always" },
      narrationText: "Do you have a question?",
      dialogueText: "Ask away.",
      narrationPerformance: performance,
      dialoguePerformance,
      after: [],
    }]);
    expect(document.project.interactions[0].outcomes[0]).not.toHaveProperty("destinationNodeId");
    expect(document.project.interactions[0].outcomes[0]).not.toHaveProperty("destination");
    expect(document.project.interactions[0].outcomes[0].after).toEqual([{
      id: "legacy-flow:ask-again-default:transition",
      type: "transition",
      destination: { nodeId: "b", openingId: null },
    }]);
  });
});
