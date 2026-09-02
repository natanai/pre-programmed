import type { BodyTypeDefinition, EquipmentRuleDefinition, EquipmentSlotDefinition, StartingEquipmentDefinition } from "../../src/features/equipment/model";
import { parseJson } from "../db/json";
import type { WorkerFeaturePersistence } from "./types";

type BodyRow = { id: string; name: string; asset_id: string; slots_json: string; starting_equipment_json: string };
type RuleRow = { item_id: string; slot_keys_json: string; storage: "inventory" | "slot"; equip_on_give_slot_key: string | null };

export const equipmentFeaturePersistence: WorkerFeaturePersistence = {
  id: "equipment",
  restoreOrder: 20,
  resetOrder: 10,
  migrations: [{
    id: 24,
    name: "equipment-own-body-and-slot-state",
    sql: `
      CREATE TABLE IF NOT EXISTS equipment_body_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        asset_id TEXT NOT NULL DEFAULT '',
        slots_json TEXT NOT NULL DEFAULT '[]',
        starting_equipment_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO equipment_body_types (id, name, asset_id, slots_json, starting_equipment_json)
      SELECT id, name, asset_id, slots_json, starting_equipment_json FROM inventory_body_backgrounds;

      CREATE TABLE IF NOT EXISTS equipment_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        starting_body_type_id TEXT
      );
      INSERT OR IGNORE INTO equipment_settings (id, starting_body_type_id)
      SELECT 1, starting_body_background_id FROM inventory_settings WHERE id = 1;
      INSERT OR IGNORE INTO equipment_settings (id, starting_body_type_id) VALUES (1, NULL);

      CREATE TABLE IF NOT EXISTS equipment_item_rules (
        item_id TEXT PRIMARY KEY REFERENCES item_definitions(id) ON DELETE CASCADE,
        slot_keys_json TEXT NOT NULL DEFAULT '[]',
        storage TEXT NOT NULL DEFAULT 'inventory' CHECK (storage IN ('inventory', 'slot')),
        equip_on_give_slot_key TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO equipment_item_rules (item_id, slot_keys_json, storage, equip_on_give_slot_key)
      SELECT id, equipment_slot_keys_json, equipped_storage, equip_on_give_slot_key FROM item_definitions;

      DROP TABLE IF EXISTS inventory_settings;
      DROP TABLE IF EXISTS inventory_body_backgrounds;
      UPDATE project_meta SET schema_version = 24 WHERE id = 1;
    `,
  }],
  async load(db) {
    const [bodies, rules, settings] = await Promise.all([
      db.prepare("SELECT id, name, asset_id, slots_json, starting_equipment_json FROM equipment_body_types ORDER BY name, id").all<BodyRow>(),
      db.prepare("SELECT item_id, slot_keys_json, storage, equip_on_give_slot_key FROM equipment_item_rules ORDER BY item_id").all<RuleRow>(),
      db.prepare("SELECT starting_body_type_id FROM equipment_settings WHERE id = 1").first<{ starting_body_type_id: string | null }>(),
    ]);
    const bodyTypes = bodies.results.map((row): BodyTypeDefinition => ({ id: row.id, name: row.name, assetId: row.asset_id, slots: parseJson<EquipmentSlotDefinition[]>(row.slots_json, []), startingEquipment: parseJson<StartingEquipmentDefinition[]>(row.starting_equipment_json, []) }));
    return {
      bodyTypes,
      equipmentRules: rules.results.map((row): EquipmentRuleDefinition => ({ itemId: row.item_id, slotKeys: parseJson(row.slot_keys_json, []), storage: row.storage === "slot" ? "slot" : "inventory", equipOnGiveSlotKey: row.equip_on_give_slot_key })),
      startingBodyTypeId: settings?.starting_body_type_id && bodyTypes.some((bodyType) => bodyType.id === settings.starting_body_type_id) ? settings.starting_body_type_id : null,
    };
  },
  mutationStatements(db, operation) {
    if (operation.type === "bodyType.upsert") {
      const body = operation.bodyType;
      return [db.prepare(`INSERT INTO equipment_body_types (id, name, asset_id, slots_json, starting_equipment_json, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, asset_id=excluded.asset_id, slots_json=excluded.slots_json, starting_equipment_json=excluded.starting_equipment_json, updated_at=CURRENT_TIMESTAMP`)
        .bind(body.id, body.name, body.assetId ?? "", JSON.stringify(body.slots ?? []), JSON.stringify(body.startingEquipment ?? []))];
    }
    if (operation.type === "bodyType.delete") return [db.prepare("UPDATE equipment_settings SET starting_body_type_id = NULL WHERE starting_body_type_id = ?").bind(operation.id), db.prepare("DELETE FROM equipment_body_types WHERE id = ?").bind(operation.id)];
    if (operation.type === "bodyType.starting") return [db.prepare(`INSERT INTO equipment_settings (id, starting_body_type_id) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET starting_body_type_id=excluded.starting_body_type_id`).bind(operation.id)];
    if (operation.type === "equipmentRule.upsert") {
      const rule = operation.rule;
      return [db.prepare(`INSERT INTO equipment_item_rules (item_id, slot_keys_json, storage, equip_on_give_slot_key, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(item_id) DO UPDATE SET slot_keys_json=excluded.slot_keys_json, storage=excluded.storage, equip_on_give_slot_key=excluded.equip_on_give_slot_key, updated_at=CURRENT_TIMESTAMP`)
        .bind(rule.itemId, JSON.stringify(rule.slotKeys ?? []), rule.storage, rule.equipOnGiveSlotKey ?? null)];
    }
    return null;
  },
  resetStatements(db) {
    return [db.prepare("DELETE FROM equipment_item_rules"), db.prepare("DELETE FROM equipment_settings"), db.prepare("DELETE FROM equipment_body_types")];
  },
  restoreOperations(snapshot) {
    return [
      ...snapshot.bodyTypes.map((bodyType) => ({ type: "bodyType.upsert" as const, bodyType })),
      { type: "bodyType.starting" as const, id: snapshot.startingBodyTypeId },
      ...snapshot.equipmentRules.map((rule) => ({ type: "equipmentRule.upsert" as const, rule })),
    ];
  },
};
