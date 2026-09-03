import type { Condition } from "../../src/engine/rules/model";
import type {
  ComputedDefinition,
  StateGroupDefinition,
  StatePlayerPresentation,
  VariableDefinition,
} from "../../src/features/state/model";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

const ALWAYS: Condition = { type: "always" };

const STATE_PRESENTATION_MIGRATION = {
  id: 29,
  name: "state player presentation groups",
  sql: `
    CREATE TABLE IF NOT EXISTS state_groups (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      visible_when_json TEXT NOT NULL DEFAULT '{"type":"always"}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE variable_definitions ADD COLUMN player_group_id TEXT;
    ALTER TABLE variable_definitions ADD COLUMN player_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE variable_definitions ADD COLUMN player_visible_when_json TEXT NOT NULL DEFAULT '{"type":"always"}';

    ALTER TABLE computed_definitions ADD COLUMN player_group_id TEXT;
    ALTER TABLE computed_definitions ADD COLUMN player_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE computed_definitions ADD COLUMN player_visible_when_json TEXT NOT NULL DEFAULT '{"type":"always"}';

    INSERT INTO state_groups (id, label, order_index, visible_when_json)
    SELECT 'legacy-status', 'Status', 0, '{"type":"always"}'
    WHERE EXISTS (SELECT 1 FROM variable_definitions WHERE show_in_status = 1)
       OR EXISTS (SELECT 1 FROM computed_definitions WHERE show_in_status = 1);

    UPDATE variable_definitions
      SET player_group_id = 'legacy-status'
      WHERE show_in_status = 1 AND player_group_id IS NULL;
    UPDATE computed_definitions
      SET player_group_id = 'legacy-status'
      WHERE show_in_status = 1 AND player_group_id IS NULL;
  `,
} as const;

type VariableRow = {
  id: string;
  key: string;
  label: string;
  value_type: "number" | "boolean" | "string";
  initial_json: string;
  player_group_id: string | null;
  player_order: number;
  player_visible_when_json: string;
  operation_interactable: number;
  operations_json: string;
  time_rate: number;
  time_unit: "second" | "minute" | "hour";
};

type ComputedRow = {
  id: string;
  key: string;
  label: string;
  source: ComputedDefinition["source"];
  format: ComputedDefinition["format"];
  player_group_id: string | null;
  player_order: number;
  player_visible_when_json: string;
  operation_interactable: number;
  operations_json: string;
};

type GroupRow = {
  id: string;
  label: string;
  order_index: number;
  visible_when_json: string;
};

function playerPresentation(row: {
  player_group_id: string | null;
  player_order: number;
  player_visible_when_json: string;
}): StatePlayerPresentation | null {
  return row.player_group_id ? {
    groupId: row.player_group_id,
    order: row.player_order,
    visibleWhen: parseJson<Condition>(row.player_visible_when_json, ALWAYS),
  } : null;
}

export const stateFeaturePersistence: WorkerFeaturePersistence = {
  id: "state",
  migrations: [STATE_PRESENTATION_MIGRATION],

  async load(db) {
    const [variables, computed, groups, variableHooks, computedHooks] = await Promise.all([
      db.prepare(
        `SELECT id, key, label, value_type, initial_json,
                player_group_id, player_order, player_visible_when_json,
                operation_interactable, operations_json, time_rate, time_unit
         FROM variable_definitions ORDER BY key`,
      ).all<VariableRow>(),
      db.prepare(
        `SELECT id, key, label, source, format,
                player_group_id, player_order, player_visible_when_json,
                operation_interactable, operations_json
         FROM computed_definitions ORDER BY key`,
      ).all<ComputedRow>(),
      db.prepare(
        "SELECT id, label, order_index, visible_when_json FROM state_groups ORDER BY order_index, label, id",
      ).all<GroupRow>(),
      loadHooksForKind(db, "variable"),
      loadHooksForKind(db, "computed"),
    ]);

    return {
      stateGroups: groups.results.map((row): StateGroupDefinition => ({
        id: row.id,
        label: row.label,
        order: row.order_index,
        visibleWhen: parseJson<Condition>(row.visible_when_json, ALWAYS),
      })),
      variables: variables.results.map((row): VariableDefinition => ({
        id: row.id,
        key: row.key,
        label: row.label,
        valueType: row.value_type,
        initialValue: parseJson(row.initial_json, null),
        playerPresentation: playerPresentation(row),
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, []),
        hooks: variableHooks.get(row.id) ?? [],
        timeRate: row.time_rate,
        timeUnit: row.time_unit,
      })),
      computedValues: computed.results.map((row): ComputedDefinition => ({
        id: row.id,
        key: row.key,
        label: row.label,
        source: row.source,
        format: row.format,
        playerPresentation: playerPresentation(row),
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, []),
        hooks: computedHooks.get(row.id) ?? [],
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "stateGroup.upsert") {
      const group = operation.group;
      return [db.prepare(
        `INSERT INTO state_groups (id, label, order_index, visible_when_json, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET label=excluded.label, order_index=excluded.order_index,
           visible_when_json=excluded.visible_when_json, updated_at=CURRENT_TIMESTAMP`,
      ).bind(group.id, group.label, group.order, JSON.stringify(group.visibleWhen ?? ALWAYS))];
    }

    if (operation.type === "stateGroup.delete") {
      return [
        db.prepare("UPDATE variable_definitions SET player_group_id = NULL WHERE player_group_id = ?").bind(operation.id),
        db.prepare("UPDATE computed_definitions SET player_group_id = NULL WHERE player_group_id = ?").bind(operation.id),
        db.prepare("DELETE FROM state_groups WHERE id = ?").bind(operation.id),
      ];
    }

    if (operation.type === "variable.upsert") {
      const value = operation.definition;
      const presentation = value.playerPresentation ?? null;
      return [
        db.prepare(
          `INSERT INTO variable_definitions
           (id, key, label, value_type, initial_json, show_in_status,
            player_group_id, player_order, player_visible_when_json,
            operation_interactable, operations_json, time_rate, time_unit, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, value_type=excluded.value_type,
             initial_json=excluded.initial_json, show_in_status=0,
             player_group_id=excluded.player_group_id, player_order=excluded.player_order,
             player_visible_when_json=excluded.player_visible_when_json,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             time_rate=excluded.time_rate, time_unit=excluded.time_unit,
             updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          value.id, value.key, value.label, value.valueType, JSON.stringify(value.initialValue),
          presentation?.groupId ?? null, presentation?.order ?? 0, JSON.stringify(presentation?.visibleWhen ?? ALWAYS),
          Number(value.interactable ?? false), JSON.stringify(value.operations ?? []), value.timeRate ?? 0, value.timeUnit ?? "second",
        ),
        ...hookStatements(db, "variable", value.id, value.hooks),
      ];
    }

    if (operation.type === "computed.upsert") {
      const value = operation.definition;
      const presentation = value.playerPresentation ?? null;
      return [
        db.prepare(
          `INSERT INTO computed_definitions
           (id, key, label, source, format, show_in_status,
            player_group_id, player_order, player_visible_when_json,
            operation_interactable, operations_json, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, source=excluded.source,
             format=excluded.format, show_in_status=0,
             player_group_id=excluded.player_group_id, player_order=excluded.player_order,
             player_visible_when_json=excluded.player_visible_when_json,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          value.id, value.key, value.label, value.source, value.format,
          presentation?.groupId ?? null, presentation?.order ?? 0, JSON.stringify(presentation?.visibleWhen ?? ALWAYS),
          Number(value.interactable ?? false), JSON.stringify(value.operations ?? []),
        ),
        ...hookStatements(db, "computed", value.id, value.hooks),
      ];
    }

    return null;
  },

  resetStatements(db) {
    return [
      resetHooksForKind(db, "variable"),
      resetHooksForKind(db, "computed"),
      db.prepare("DELETE FROM variable_definitions"),
      db.prepare("DELETE FROM computed_definitions"),
      db.prepare("DELETE FROM state_groups"),
    ];
  },

  restoreOperations(snapshot) {
    return [
      ...snapshot.stateGroups.map((group) => ({ type: "stateGroup.upsert" as const, group })),
      ...snapshot.variables.map((definition) => ({ type: "variable.upsert" as const, definition })),
      ...snapshot.computedValues.map((definition) => ({ type: "computed.upsert" as const, definition })),
    ];
  },
};
