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

  it("migrates the response-level capture prototype into the same editable flow preset", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const flowMigration = migrations.find((migration) => migration.id === 47);
    expect(flowMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 47)) {
        applyMigration(database, migration.sql);
      }

      const start = database.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").get() as { start_node_id: string };
      database.prepare(`
        INSERT INTO interactions
          (id, source_node_id, order_index, wording, match_mode, capture_input, choice_visibility, tags_json, notes)
        VALUES ('ask-name', ?, 0, 'ask name', 'command', 0, 'prompt', '[]', '')
      `).run(start.start_node_id);
      database.prepare(`
        INSERT INTO interaction_outcomes
          (id, interaction_id, order_index, label, condition_json, response_text, response_dialogue_text,
           response_speaker_id, response_characters_per_second, response_performance_json,
           response_dialogue_performance_json, effects_json, input_capture_json, disposition,
           destination_node_id, destination_opening_id, author_status)
        VALUES (
          'ask-name-default', 'ask-name', 0, 'default', '{"type":"always"}', 'Who are you?', '',
          NULL, 18, '{"charactersPerSecond":18,"cues":[]}', '{"charactersPerSecond":18,"cues":[]}',
          '[]',
          '{"effects":[{"id":"save-name","type":"set_value","key":"player_name","value":{"kind":"binding","key":"input.raw"}}],"disposition":"stay","destination":null}',
          'stay', NULL, NULL, 'configured'
        )
      `);

      applyMigration(database, flowMigration!.sql);

      const row = database.prepare(
        "SELECT after_flow_json FROM interaction_outcomes WHERE id = 'ask-name-default'",
      ).get() as { after_flow_json: string };
      const flow = JSON.parse(row.after_flow_json) as Array<Record<string, unknown>>;

      expect(flow.map((step) => step.type)).toEqual(["await_input", "effects", "present"]);
      expect(flow[1]).toMatchObject({
        effects: [{
          type: "set_value",
          key: "player_name",
          value: { kind: "binding", key: "input.raw" },
        }],
      });
      expect(flow[2]).toMatchObject({
        type: "present",
        responseText: "",
        dialogueText: "",
      });
    } finally {
      database.close();
    }
  });

  it("migrates legacy Node-level input capture into the owning opening flow", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const flowMigration = migrations.find((migration) => migration.id === 47);
    expect(flowMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 47)) {
        applyMigration(database, migration.sql);
      }

      const start = database.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").get() as { start_node_id: string };
      database.prepare(`
        INSERT INTO interactions
          (id, source_node_id, order_index, wording, match_mode, capture_input, choice_visibility, tags_json, notes)
        VALUES ('legacy-name-capture', ?, 0, '', 'command', 1, 'typed', '[]', '')
      `).run(start.start_node_id);
      database.prepare(`
        INSERT INTO interaction_outcomes
          (id, interaction_id, order_index, label, condition_json, response_text, response_dialogue_text,
           response_speaker_id, response_characters_per_second, response_performance_json,
           response_dialogue_performance_json, effects_json, input_capture_json, disposition,
           destination_node_id, destination_opening_id, author_status)
        VALUES (
          'legacy-name-capture-default', 'legacy-name-capture', 0, 'default', '{"type":"always"}', '',
          'Hello {{ref:state.variable:player-name|value}}.', NULL, 18,
          '{"charactersPerSecond":18,"cues":[]}', '{"charactersPerSecond":30,"cues":[]}',
          '[{"id":"save-name","type":"set_value","key":"player_name","value":{"kind":"binding","key":"input.raw"}}]',
          NULL, 'transition', ?, NULL, 'configured'
        )
      `).run(start.start_node_id);

      applyMigration(database, flowMigration!.sql);

      const opening = database.prepare(`
        SELECT after_flow_json
        FROM node_openings
        WHERE node_id = ?
        ORDER BY order_index, id
        LIMIT 1
      `).get(start.start_node_id) as { after_flow_json: string };
      const interaction = database.prepare(
        "SELECT id FROM interactions WHERE id = 'legacy-name-capture'",
      ).get();
      const meta = database.prepare("SELECT schema_version FROM project_meta WHERE id = 1").get() as { schema_version: number };
      const flow = JSON.parse(opening.after_flow_json) as Array<Record<string, unknown>>;

      expect(flow.map((step) => step.type)).toEqual(["await_input", "effects", "present", "transition"]);
      expect(flow[1]).toMatchObject({
        type: "effects",
        effects: [{
          type: "set_value",
          key: "player_name",
          value: { kind: "binding", key: "input.raw" },
        }],
      });
      expect(flow[2]).toMatchObject({
        type: "present",
        dialogueText: "Hello {{ref:state.variable:player-name|value}}.",
        dialoguePerformance: { charactersPerSecond: 30, cues: [] },
      });
      expect(flow[3]).toMatchObject({
        type: "transition",
        destination: { nodeId: start.start_node_id, openingId: null },
      });
      expect(interaction).toBeUndefined();
      expect(meta.schema_version).toBe(47);
    } finally {
      database.close();
    }
  });

  it("moves legacy speaker-authored interaction text into dialogue without losing its voice", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const proseMigration = migrations.find((migration) => migration.id === 40);
    expect(proseMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 40)) {
        applyMigration(database, migration.sql);
      }
      const start = database.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").get() as { start_node_id: string };
      database.exec(`
        INSERT INTO entity_definitions (id, key, entity_type, name)
        VALUES ('marta', 'marta', 'character', 'Marta');
        INSERT INTO interactions (id, source_node_id, wording)
        VALUES ('ask', '${start.start_node_id}', 'ask');
        INSERT INTO interaction_outcomes
          (id, interaction_id, response_text, response_speaker_id, response_characters_per_second, response_performance_json)
        VALUES
          ('answer', 'ask', 'Hello.', 'marta', 27, '{"charactersPerSecond":27,"cues":[]}');
      `);

      applyMigration(database, proseMigration!.sql);
      const row = database.prepare(`
        SELECT response_text, response_dialogue_text, response_speaker_id,
               response_performance_json, response_dialogue_performance_json
        FROM interaction_outcomes WHERE id = 'answer'
      `).get() as {
        response_text: string;
        response_dialogue_text: string;
        response_speaker_id: string | null;
        response_performance_json: string;
        response_dialogue_performance_json: string;
      };
      expect(row.response_text).toBe("");
      expect(row.response_dialogue_text).toBe("Hello.");
      expect(row.response_speaker_id).toBe("marta");
      expect(JSON.parse(row.response_performance_json).charactersPerSecond).toBe(18);
      expect(JSON.parse(row.response_dialogue_performance_json).charactersPerSecond).toBe(27);
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

  it("migrates legacy grid32 media rows into the generic vector-grid mode", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const vectorMigration = migrations.find((migration) => migration.id === 30);
    expect(vectorMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 30)) {
        applyMigration(database, migration.sql);
      }

      database.exec(`
        INSERT INTO media_assets
          (id, name, kind, mime_type, content_key, byte_length, intrinsic_width, intrinsic_height, default_presentation, authoring_mode)
        VALUES
          ('legacy-vector', 'legacy.svg', 'image', 'image/svg+xml', 'content_legacy', 42, 32, 32, 'inline', 'grid32');
      `);

      applyMigration(database, vectorMigration!.sql);

      const row = database.prepare("SELECT authoring_mode, intrinsic_width, intrinsic_height FROM media_assets WHERE id = 'legacy-vector'").get() as {
        authoring_mode: string;
        intrinsic_width: number;
        intrinsic_height: number;
      } | undefined;
      expect(row).toEqual({ authoring_mode: "vector-grid", intrinsic_width: 32, intrinsic_height: 32 });
      expect(() => database.exec(`
        INSERT INTO media_assets
          (id, name, kind, mime_type, content_key, byte_length, default_presentation, authoring_mode)
        VALUES ('bad-old-mode', 'bad.svg', 'image', 'image/svg+xml', NULL, 0, 'inline', 'grid32');
      `)).toThrow();
    } finally {
      database.close();
    }
  });

  it("preserves Body slot placement while migrating percentages into logical coordinates", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const bodyCanvasMigration = migrations.find((migration) => migration.id === 31);
    expect(bodyCanvasMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 31)) {
        applyMigration(database, migration.sql);
      }

      database.exec(`
        INSERT INTO inventory_body_backgrounds (id, name, slots_json)
        VALUES (
          'legacy-body',
          'Legacy body',
          '[{"id":"head","key":"head","name":"Head","x":25,"y":50,"width":20,"height":10}]'
        );
      `);

      applyMigration(database, bodyCanvasMigration!.sql);

      const row = database.prepare("SELECT canvas_json, slots_json FROM inventory_body_backgrounds WHERE id = 'legacy-body'").get() as {
        canvas_json: string;
        slots_json: string;
      } | undefined;
      expect(JSON.parse(row?.canvas_json ?? "null")).toEqual({ width: 48, height: 64, fit: "contain" });
      expect(JSON.parse(row?.slots_json ?? "[]")[0]).toMatchObject({
        id: "head",
        key: "head",
        name: "Head",
        x: 12,
        y: 32,
        width: 9.6,
        height: 6.4,
      });
    } finally {
      database.close();
    }
  });

  it("migrates legacy compatible slots into equivalent one-slot equipment placements", () => {
    const database = new DatabaseSync(":memory:");
    const migrations = currentMigrations();
    const equipmentMigration = migrations.find((migration) => migration.id === 32);
    expect(equipmentMigration).toBeDefined();

    try {
      for (const migration of migrations.filter((migration) => migration.id < 32)) {
        applyMigration(database, migration.sql);
      }

      database.exec(`
        INSERT INTO item_definitions (id, key, name, equipment_slot_keys_json)
        VALUES ('legacy-item', 'legacy-item', 'Legacy item', '["left","right"]');
      `);

      applyMigration(database, equipmentMigration!.sql);

      const row = database.prepare("SELECT equipment_placements_json FROM item_definitions WHERE id = 'legacy-item'").get() as {
        equipment_placements_json: string;
      } | undefined;
      expect(JSON.parse(row?.equipment_placements_json ?? "[]")).toEqual([
        { anchorSlotKey: "left", occupiedSlotKeys: ["left"] },
        { anchorSlotKey: "right", occupiedSlotKeys: ["right"] },
      ]);
    } finally {
      database.close();
    }
  });
});
