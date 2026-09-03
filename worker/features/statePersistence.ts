import type { ComputedDefinition, VariableDefinition } from "../../src/features/state/model";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

type VariableRow = {
  id: string;
  key: string;
  label: string;
  value_type: "number" | "boolean" | "string";
  initial_json: string;
  show_in_status: number;
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
  show_in_status: number;
  operation_interactable: number;
  operations_json: string;
};

export const stateFeaturePersistence: WorkerFeaturePersistence = {
  id: "state",

  async load(db) {
    const [variables, computed, variableHooks, computedHooks] = await Promise.all([
      db.prepare(
        "SELECT id, key, label, value_type, initial_json, show_in_status, operation_interactable, operations_json, time_rate, time_unit FROM variable_definitions ORDER BY key",
      ).all<VariableRow>(),
      db.prepare(
        "SELECT id, key, label, source, format, show_in_status, operation_interactable, operations_json FROM computed_definitions ORDER BY key",
      ).all<ComputedRow>(),
      loadHooksForKind(db, "variable"),
      loadHooksForKind(db, "computed"),
    ]);

    return {
      variables: variables.results.map((row): VariableDefinition => ({
        id: row.id,
        key: row.key,
        label: row.label,
        valueType: row.value_type,
        initialValue: parseJson(row.initial_json, null),
        showInStatus: Boolean(row.show_in_status),
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
        showInStatus: Boolean(row.show_in_status),
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, []),
        hooks: computedHooks.get(row.id) ?? [],
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "variable.upsert") {
      const value = operation.definition;
      return [
        db.prepare(
          `INSERT INTO variable_definitions
           (id, key, label, value_type, initial_json, show_in_status, operation_interactable, operations_json, time_rate, time_unit, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, value_type=excluded.value_type,
             initial_json=excluded.initial_json, show_in_status=excluded.show_in_status,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             time_rate=excluded.time_rate, time_unit=excluded.time_unit,
             updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          value.id, value.key, value.label, value.valueType, JSON.stringify(value.initialValue), Number(value.showInStatus),
          Number(value.interactable ?? false), JSON.stringify(value.operations ?? []), value.timeRate ?? 0, value.timeUnit ?? "second",
        ),
        ...hookStatements(db, "variable", value.id, value.hooks),
      ];
    }

    if (operation.type === "computed.upsert") {
      const value = operation.definition;
      return [
        db.prepare(
          `INSERT INTO computed_definitions
           (id, key, label, source, format, show_in_status, operation_interactable, operations_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, source=excluded.source,
             format=excluded.format, show_in_status=excluded.show_in_status,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          value.id, value.key, value.label, value.source, value.format, Number(value.showInStatus),
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
    ];
  },

  restoreOperations(snapshot) {
    return [
      ...snapshot.variables.map((definition) => ({ type: "variable.upsert" as const, definition })),
      ...snapshot.computedValues.map((definition) => ({ type: "computed.upsert" as const, definition })),
    ];
  },
};
