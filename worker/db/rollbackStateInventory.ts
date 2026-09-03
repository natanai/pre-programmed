import { executeSqlScript } from "./migrations";

export const STATE_INVENTORY_ROLLBACK_ID = 28;
export const STATE_INVENTORY_ROLLBACK_NAME = "restore-pre-replacement-state-inventory";

/**
 * Production-only recovery bridge for databases that already ran replacement
 * migrations 22-27 before the State/Inventory rollback.
 *
 * Fresh installations never call this. They continue through the pre-replacement
 * migration catalog normally. This bridge only reconstructs the durable storage
 * shape expected by the restored State + Inventory runtime from the replacement
 * tables that already exist in an upgraded database.
 */
export const STATE_INVENTORY_ROLLBACK_SQL = `
  CREATE TABLE variable_definitions (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    value_type TEXT NOT NULL CHECK (value_type IN ('number', 'boolean', 'string')),
    initial_json TEXT NOT NULL,
    show_in_status INTEGER NOT NULL DEFAULT 0 CHECK (show_in_status IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation_interactable INTEGER NOT NULL DEFAULT 0 CHECK (operation_interactable IN (0, 1)),
    operations_json TEXT NOT NULL DEFAULT '[]',
    time_rate REAL NOT NULL DEFAULT 0,
    time_unit TEXT NOT NULL DEFAULT 'second' CHECK (time_unit IN ('second', 'minute', 'hour'))
  );

  INSERT INTO variable_definitions
    (id, key, label, value_type, initial_json, show_in_status, updated_at,
     operation_interactable, operations_json, time_rate, time_unit)
  SELECT
    value.id,
    value.key,
    value.label,
    value.value_type,
    value.initial_json,
    CASE WHEN EXISTS (
      SELECT 1 FROM status_entries entry
      WHERE entry.source_kind = 'value' AND entry.source_id = value.id
    ) THEN 1 ELSE 0 END,
    value.updated_at,
    value.operation_interactable,
    value.operations_json,
    value.time_rate,
    value.time_unit
  FROM value_definitions value;

  CREATE TABLE computed_definitions (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    source TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'raw',
    show_in_status INTEGER NOT NULL DEFAULT 0 CHECK (show_in_status IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation_interactable INTEGER NOT NULL DEFAULT 0 CHECK (operation_interactable IN (0, 1)),
    operations_json TEXT NOT NULL DEFAULT '[]'
  );

  INSERT INTO computed_definitions
    (id, key, label, source, format, show_in_status, updated_at,
     operation_interactable, operations_json)
  SELECT
    derived.id,
    derived.key,
    derived.label,
    CASE derived.source_provider || ':' || derived.source_metric
      WHEN 'session:elapsed_seconds' THEN 'elapsed_seconds'
      WHEN 'commands:entered' THEN 'commands_entered'
      WHEN 'inventory:occupied_cells' THEN 'inventory_slots_used'
      WHEN 'narrative:visited_nodes' THEN 'visited_nodes'
      ELSE derived.source_provider || ':' || derived.source_metric
    END,
    derived.format,
    CASE WHEN EXISTS (
      SELECT 1 FROM status_entries entry
      WHERE entry.source_kind = 'derived' AND entry.source_id = derived.id
    ) THEN 1 ELSE 0 END,
    derived.updated_at,
    derived.operation_interactable,
    derived.operations_json
  FROM derived_value_definitions derived;

  ALTER TABLE item_definitions ADD COLUMN asset_path TEXT NOT NULL DEFAULT '';
  ALTER TABLE item_definitions ADD COLUMN width INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE item_definitions ADD COLUMN height INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE item_definitions ADD COLUMN equipment_slot_keys_json TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE item_definitions ADD COLUMN equipped_storage TEXT NOT NULL DEFAULT 'inventory';
  ALTER TABLE item_definitions ADD COLUMN equip_on_give_slot_key TEXT;

  UPDATE item_definitions
  SET width = COALESCE((
        SELECT max(1, min(10, layout.width))
        FROM inventory_item_layouts layout
        WHERE layout.item_id = item_definitions.id
      ), 1),
      height = COALESCE((
        SELECT max(1, min(6, layout.height))
        FROM inventory_item_layouts layout
        WHERE layout.item_id = item_definitions.id
      ), 1),
      equipment_slot_keys_json = COALESCE((
        SELECT rule.slot_keys_json
        FROM equipment_item_rules rule
        WHERE rule.item_id = item_definitions.id
      ), '[]'),
      equipped_storage = COALESCE((
        SELECT rule.storage
        FROM equipment_item_rules rule
        WHERE rule.item_id = item_definitions.id
      ), 'inventory'),
      equip_on_give_slot_key = (
        SELECT rule.equip_on_give_slot_key
        FROM equipment_item_rules rule
        WHERE rule.item_id = item_definitions.id
      );

  CREATE TABLE inventory_body_backgrounds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_path TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    slots_json TEXT NOT NULL DEFAULT '[]',
    starting_equipment_json TEXT NOT NULL DEFAULT '[]',
    asset_id TEXT NOT NULL DEFAULT ''
  );

  INSERT INTO inventory_body_backgrounds
    (id, name, asset_path, created_at, updated_at, slots_json, starting_equipment_json, asset_id)
  SELECT
    body.id,
    body.name,
    '',
    body.created_at,
    body.updated_at,
    body.slots_json,
    body.starting_equipment_json,
    body.asset_id
  FROM equipment_body_types body;

  CREATE TABLE inventory_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    starting_body_background_id TEXT
  );

  INSERT INTO inventory_settings (id, starting_body_background_id)
  SELECT 1, starting_body_type_id FROM equipment_settings WHERE id = 1;
  INSERT OR IGNORE INTO inventory_settings (id, starting_body_background_id) VALUES (1, NULL);

  UPDATE operation_hooks SET target_kind = 'variable' WHERE target_kind = 'value';
  UPDATE operation_hooks SET target_kind = 'computed' WHERE target_kind = 'derived';

  UPDATE interaction_outcomes
  SET effects_json = replace(
    replace(effects_json, '"type":"set_body_type"', '"type":"set_body_background"'),
    '"bodyTypeId":',
    '"backgroundId":'
  )
  WHERE effects_json LIKE '%set_body_type%';

  UPDATE operation_hooks
  SET effects_json = replace(
    replace(effects_json, '"type":"set_body_type"', '"type":"set_body_background"'),
    '"bodyTypeId":',
    '"backgroundId":'
  )
  WHERE effects_json LIKE '%set_body_type%';

  UPDATE project_meta
  SET settings_json = replace(replace(settings_json, 'values.value', 'state.variable'), 'values.derived', 'state.computed')
  WHERE id = 1 AND (settings_json LIKE '%values.value%' OR settings_json LIKE '%values.derived%');

  UPDATE project_meta SET schema_version = 28 WHERE id = 1;
`;

export async function restorePreReplacementStateInventorySchema(db: D1Database) {
  await executeSqlScript(db, STATE_INVENTORY_ROLLBACK_SQL);
}
