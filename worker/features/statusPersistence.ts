import type { Condition } from "../../src/engine/rules/model";
import type { StatusEntryDefinition, StatusGroupDefinition } from "../../src/features/status/model";
import { parseJson } from "../db/json";
import type { WorkerFeaturePersistence } from "./types";

type GroupRow = { id: string; key: string; label: string; order_index: number; condition_json: string };
type EntryRow = { id: string; group_id: string; source_kind: "value" | "derived"; source_id: string; label: string; order_index: number; condition_json: string };

export const statusFeaturePersistence: WorkerFeaturePersistence = {
  id: "status",
  migrations: [{
    id: 22,
    name: "values-status-separation",
    sql: `
      UPDATE operation_hooks SET target_kind = 'value' WHERE target_kind = 'variable';
      UPDATE operation_hooks SET target_kind = 'derived' WHERE target_kind = 'computed';

      UPDATE computed_definitions SET source = CASE source
        WHEN 'elapsed_seconds' THEN 'session:elapsed_seconds'
        WHEN 'commands_entered' THEN 'commands:entered'
        WHEN 'inventory_slots_used' THEN 'inventory:occupied_cells'
        WHEN 'visited_nodes' THEN 'narrative:visited_nodes'
        ELSE source
      END
      WHERE instr(source, ':') = 0;

      CREATE TABLE IF NOT EXISTS status_groups (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        condition_json TEXT NOT NULL DEFAULT '{"type":"always"}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS status_entries (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES status_groups(id) ON DELETE CASCADE,
        source_kind TEXT NOT NULL CHECK (source_kind IN ('value', 'derived')),
        source_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        order_index INTEGER NOT NULL DEFAULT 0,
        condition_json TEXT NOT NULL DEFAULT '{"type":"always"}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_status_entries_group ON status_entries(group_id, order_index, id);

      INSERT OR IGNORE INTO status_groups (id, key, label, order_index, condition_json)
      SELECT 'migrated-status', 'status', 'Status', 0, '{"type":"always"}'
      WHERE EXISTS (SELECT 1 FROM variable_definitions WHERE show_in_status = 1)
         OR EXISTS (SELECT 1 FROM computed_definitions WHERE show_in_status = 1);

      INSERT OR IGNORE INTO status_entries (id, group_id, source_kind, source_id, label, order_index, condition_json)
      SELECT 'migrated-value-' || id, 'migrated-status', 'value', id, label, row_number() OVER (ORDER BY key), '{"type":"always"}'
      FROM variable_definitions WHERE show_in_status = 1;

      INSERT OR IGNORE INTO status_entries (id, group_id, source_kind, source_id, label, order_index, condition_json)
      SELECT 'migrated-derived-' || id, 'migrated-status', 'derived', id, label,
             (SELECT count(*) FROM variable_definitions WHERE show_in_status = 1) + row_number() OVER (ORDER BY key), '{"type":"always"}'
      FROM computed_definitions WHERE show_in_status = 1;

      UPDATE project_meta
      SET settings_json = replace(replace(settings_json, 'state.variable', 'values.value'), 'state.computed', 'values.derived')
      WHERE id = 1 AND (settings_json LIKE '%state.variable%' OR settings_json LIKE '%state.computed%');

      UPDATE project_meta SET schema_version = 22 WHERE id = 1;
    `,
  }],

  async load(db) {
    const [groups, entries] = await Promise.all([
      db.prepare("SELECT id, key, label, order_index, condition_json FROM status_groups ORDER BY order_index, id").all<GroupRow>(),
      db.prepare("SELECT id, group_id, source_kind, source_id, label, order_index, condition_json FROM status_entries ORDER BY group_id, order_index, id").all<EntryRow>(),
    ]);

    return {
      statusGroups: groups.results.map((row): StatusGroupDefinition => ({
        id: row.id,
        key: row.key,
        label: row.label,
        order: row.order_index,
        visibleWhen: parseJson<Condition>(row.condition_json, { type: "always" }),
      })),
      statusEntries: entries.results.map((row): StatusEntryDefinition => ({
        id: row.id,
        groupId: row.group_id,
        source: { kind: row.source_kind, id: row.source_id },
        label: row.label,
        order: row.order_index,
        visibleWhen: parseJson<Condition>(row.condition_json, { type: "always" }),
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "statusGroup.upsert") {
      const group = operation.group;
      return [db.prepare(`INSERT INTO status_groups (id, key, label, order_index, condition_json, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET key=excluded.key, label=excluded.label,
          order_index=excluded.order_index, condition_json=excluded.condition_json, updated_at=CURRENT_TIMESTAMP`)
        .bind(group.id, group.key, group.label, group.order, JSON.stringify(group.visibleWhen))];
    }

    if (operation.type === "statusEntry.upsert") {
      const entry = operation.entry;
      return [db.prepare(`INSERT INTO status_entries
        (id, group_id, source_kind, source_id, label, order_index, condition_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id, source_kind=excluded.source_kind,
          source_id=excluded.source_id, label=excluded.label, order_index=excluded.order_index,
          condition_json=excluded.condition_json, updated_at=CURRENT_TIMESTAMP`)
        .bind(
          entry.id,
          entry.groupId,
          entry.source.kind,
          entry.source.id,
          entry.label,
          entry.order,
          JSON.stringify(entry.visibleWhen),
        )];
    }

    return null;
  },

  resetStatements(db) {
    return [db.prepare("DELETE FROM status_entries"), db.prepare("DELETE FROM status_groups")];
  },

  restoreOperations(snapshot) {
    return [
      ...snapshot.statusGroups.map((group) => ({ type: "statusGroup.upsert" as const, group })),
      ...snapshot.statusEntries.map((entry) => ({ type: "statusEntry.upsert" as const, entry })),
    ];
  },
};
