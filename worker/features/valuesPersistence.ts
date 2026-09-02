import type { DerivedValueDefinition, ValueDefinition } from "../../src/features/values/model";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

type ValueRow = {
  id: string;
  key: string;
  label: string;
  value_type: "number" | "boolean" | "string";
  initial_json: string;
  operation_interactable: number;
  operations_json: string;
  time_rate: number;
  time_unit: "second" | "minute" | "hour";
};

type DerivedRow = {
  id: string;
  key: string;
  label: string;
  source_provider: string;
  source_metric: string;
  format: "raw" | "integer" | "seconds";
  operation_interactable: number;
  operations_json: string;
};

export const valuesFeaturePersistence: WorkerFeaturePersistence = {
  id: "values",
  migrations: [{
    id: 25,
    name: "values-own-definition-storage",
    sql: `
      CREATE TABLE value_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        value_type TEXT NOT NULL CHECK (value_type IN ('number', 'boolean', 'string')),
        initial_json TEXT NOT NULL,
        operation_interactable INTEGER NOT NULL DEFAULT 0 CHECK (operation_interactable IN (0, 1)),
        operations_json TEXT NOT NULL DEFAULT '[]',
        time_rate REAL NOT NULL DEFAULT 0,
        time_unit TEXT NOT NULL DEFAULT 'second' CHECK (time_unit IN ('second', 'minute', 'hour')),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO value_definitions
        (id, key, label, value_type, initial_json, operation_interactable, operations_json, time_rate, time_unit, updated_at)
      SELECT id, key, label, value_type, initial_json, operation_interactable, operations_json, time_rate, time_unit, updated_at
      FROM variable_definitions;

      CREATE TABLE derived_value_definitions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        source_provider TEXT NOT NULL,
        source_metric TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'raw' CHECK (format IN ('raw', 'integer', 'seconds')),
        operation_interactable INTEGER NOT NULL DEFAULT 0 CHECK (operation_interactable IN (0, 1)),
        operations_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO derived_value_definitions
        (id, key, label, source_provider, source_metric, format, operation_interactable, operations_json, updated_at)
      SELECT
        id,
        key,
        label,
        CASE WHEN instr(source, ':') > 0 THEN substr(source, 1, instr(source, ':') - 1) ELSE 'session' END,
        CASE WHEN instr(source, ':') > 0 THEN substr(source, instr(source, ':') + 1) ELSE source END,
        format,
        operation_interactable,
        operations_json,
        updated_at
      FROM computed_definitions;

      DROP TABLE variable_definitions;
      DROP TABLE computed_definitions;

      UPDATE project_meta SET schema_version = 25 WHERE id = 1;
    `,
  }],

  async load(db) {
    const [values, derived, valueHooks, derivedHooks] = await Promise.all([
      db.prepare(`SELECT id, key, label, value_type, initial_json, operation_interactable, operations_json, time_rate, time_unit
        FROM value_definitions ORDER BY key`).all<ValueRow>(),
      db.prepare(`SELECT id, key, label, source_provider, source_metric, format, operation_interactable, operations_json
        FROM derived_value_definitions ORDER BY key`).all<DerivedRow>(),
      loadHooksForKind(db, "value"),
      loadHooksForKind(db, "derived"),
    ]);

    return {
      valueDefinitions: values.results.map((row): ValueDefinition => ({
        id: row.id,
        key: row.key,
        label: row.label,
        valueType: row.value_type,
        initialValue: parseJson(row.initial_json, null),
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, []),
        hooks: valueHooks.get(row.id) ?? [],
        timeRate: row.time_rate,
        timeUnit: row.time_unit,
      })),
      derivedValueDefinitions: derived.results.map((row): DerivedValueDefinition => ({
        id: row.id,
        key: row.key,
        label: row.label,
        source: { provider: row.source_provider, metric: row.source_metric },
        format: row.format,
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, []),
        hooks: derivedHooks.get(row.id) ?? [],
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "value.upsert") {
      const value = operation.definition;
      return [
        db.prepare(`INSERT INTO value_definitions
          (id, key, label, value_type, initial_json, operation_interactable, operations_json, time_rate, time_unit, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label, value_type=excluded.value_type,
            initial_json=excluded.initial_json, operation_interactable=excluded.operation_interactable,
            operations_json=excluded.operations_json, time_rate=excluded.time_rate, time_unit=excluded.time_unit,
            updated_at=CURRENT_TIMESTAMP`)
          .bind(
            value.id,
            value.key,
            value.label,
            value.valueType,
            JSON.stringify(value.initialValue),
            Number(value.interactable),
            JSON.stringify(value.operations ?? []),
            value.timeRate ?? 0,
            value.timeUnit ?? "second",
          ),
        ...hookStatements(db, "value", value.id, value.hooks ?? []),
      ];
    }

    if (operation.type === "derivedValue.upsert") {
      const value = operation.definition;
      return [
        db.prepare(`INSERT INTO derived_value_definitions
          (id, key, label, source_provider, source_metric, format, operation_interactable, operations_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label,
            source_provider=excluded.source_provider, source_metric=excluded.source_metric, format=excluded.format,
            operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
            updated_at=CURRENT_TIMESTAMP`)
          .bind(
            value.id,
            value.key,
            value.label,
            value.source.provider,
            value.source.metric,
            value.format,
            Number(value.interactable),
            JSON.stringify(value.operations ?? []),
          ),
        ...hookStatements(db, "derived", value.id, value.hooks ?? []),
      ];
    }

    return null;
  },

  resetStatements(db) {
    return [
      resetHooksForKind(db, "value"),
      resetHooksForKind(db, "derived"),
      db.prepare("DELETE FROM value_definitions"),
      db.prepare("DELETE FROM derived_value_definitions"),
    ];
  },

  restoreOperations(snapshot) {
    return [
      ...snapshot.valueDefinitions.map((definition) => ({ type: "value.upsert" as const, definition })),
      ...snapshot.derivedValueDefinitions.map((definition) => ({ type: "derivedValue.upsert" as const, definition })),
    ];
  },
};
