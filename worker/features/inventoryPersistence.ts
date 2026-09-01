import type { BodyBackgroundDefinition, BodySlotDefinition, ItemDefinition, StartingEquipmentDefinition } from "../../src/features/inventory/model";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

type ItemRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  asset_path: string;
  width: number;
  height: number;
  stackable: number;
  max_stack: number;
  removable: number;
  starting_quantity: number;
  operation_interactable: number;
  operations_json: string;
  equipment_slot_keys_json: string;
  equipped_storage: "inventory" | "slot";
  tags_json: string;
  initial_state_json: string;
};

type BodyBackgroundRow = {
  id: string;
  name: string;
  asset_path: string;
  slots_json: string;
  starting_equipment_json: string;
};

export const inventoryFeaturePersistence: WorkerFeaturePersistence = {
  id: "inventory",
  migrations: [
    {
      id: 13,
      name: "inventory-body-backgrounds",
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_body_backgrounds (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          asset_path TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          starting_body_background_id TEXT
        );

        INSERT OR IGNORE INTO inventory_settings (id, starting_body_background_id)
        VALUES (1, NULL);

        UPDATE project_meta SET schema_version = 13 WHERE id = 1;
      `,
    },
    {
      id: 14,
      name: "inventory-body-slots-and-equipment",
      sql: `
        ALTER TABLE inventory_body_backgrounds
        ADD COLUMN slots_json TEXT NOT NULL DEFAULT '[]';

        ALTER TABLE item_definitions
        ADD COLUMN equipment_slot_keys_json TEXT NOT NULL DEFAULT '[]';

        UPDATE project_meta SET schema_version = 14 WHERE id = 1;
      `,
    },
    {
      id: 15,
      name: "inventory-starting-equipment-and-storage",
      sql: `
        ALTER TABLE item_definitions
        ADD COLUMN equipped_storage TEXT NOT NULL DEFAULT 'inventory'
          CHECK (equipped_storage IN ('inventory', 'slot'));

        ALTER TABLE inventory_body_backgrounds
        ADD COLUMN starting_equipment_json TEXT NOT NULL DEFAULT '[]';

        UPDATE project_meta SET schema_version = 15 WHERE id = 1;
      `,
    },
  ],

  async load(db) {
    const [items, hookGroups, backgrounds, settings] = await Promise.all([
      db.prepare(
        `SELECT id, key, name, description, asset_path, width, height, stackable,
                max_stack, removable, starting_quantity, operation_interactable, operations_json,
                equipment_slot_keys_json, equipped_storage, tags_json, initial_state_json
           FROM item_definitions ORDER BY key`,
      ).all<ItemRow>(),
      loadHooksForKind(db, "item"),
      db.prepare(
        "SELECT id, name, asset_path, slots_json, starting_equipment_json FROM inventory_body_backgrounds ORDER BY name, id",
      ).all<BodyBackgroundRow>(),
      db.prepare(
        "SELECT starting_body_background_id FROM inventory_settings WHERE id = 1",
      ).first<{ starting_body_background_id: string | null }>(),
    ]);

    const bodyBackgrounds = backgrounds.results.map((row): BodyBackgroundDefinition => ({
      id: row.id,
      name: row.name,
      assetPath: row.asset_path,
      slots: parseJson<BodySlotDefinition[]>(row.slots_json, []),
      startingEquipment: parseJson<StartingEquipmentDefinition[]>(row.starting_equipment_json, []),
    }));
    const configuredStartingId = settings?.starting_body_background_id ?? null;

    return {
      items: items.results.map((row): ItemDefinition => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        assetPath: row.asset_path,
        width: row.width,
        height: row.height,
        stackable: Boolean(row.stackable),
        maxStack: row.max_stack,
        removable: Boolean(row.removable),
        startingQuantity: row.starting_quantity,
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, ["inspect", "use", "move", "remove"]),
        equipmentSlotKeys: parseJson(row.equipment_slot_keys_json, []),
        equippedStorage: row.equipped_storage === "slot" ? "slot" : "inventory",
        tags: parseJson(row.tags_json, []),
        initialState: parseJson(row.initial_state_json, {}),
        hooks: hookGroups.get(row.id) ?? [],
      })),
      bodyBackgrounds,
      startingBodyBackgroundId: configuredStartingId && bodyBackgrounds.some((bodyType) => bodyType.id === configuredStartingId)
        ? configuredStartingId
        : null,
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "item.upsert") {
      const item = operation.item;
      return [
        db.prepare(
          `INSERT INTO item_definitions
           (id, key, name, description, asset_path, width, height, stackable, max_stack,
            removable, starting_quantity, operation_interactable, operations_json,
            equipment_slot_keys_json, equipped_storage, tags_json, initial_state_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, name=excluded.name,
             description=excluded.description, asset_path=excluded.asset_path, width=excluded.width,
             height=excluded.height, stackable=excluded.stackable, max_stack=excluded.max_stack,
             removable=excluded.removable, starting_quantity=excluded.starting_quantity,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             equipment_slot_keys_json=excluded.equipment_slot_keys_json,
             equipped_storage=excluded.equipped_storage,
             tags_json=excluded.tags_json,
             initial_state_json=excluded.initial_state_json, updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          item.id, item.key, item.name, item.description, item.assetPath, item.width, item.height,
          Number(item.stackable), item.maxStack, Number(item.removable), item.startingQuantity ?? 0,
          Number(item.interactable ?? true), JSON.stringify(item.operations ?? ["inspect", "use", "move", "remove"]),
          JSON.stringify(item.equipmentSlotKeys ?? []), item.equippedStorage ?? "inventory",
          JSON.stringify(item.tags), JSON.stringify(item.initialState),
        ),
        ...hookStatements(db, "item", item.id, item.hooks),
      ];
    }

    if (operation.type === "bodyBackground.upsert") {
      const bodyType = operation.background;
      return [db.prepare(
        `INSERT INTO inventory_body_backgrounds (id, name, asset_path, slots_json, starting_equipment_json, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, asset_path=excluded.asset_path,
           slots_json=excluded.slots_json, starting_equipment_json=excluded.starting_equipment_json,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        bodyType.id,
        bodyType.name,
        bodyType.assetPath,
        JSON.stringify(bodyType.slots ?? []),
        JSON.stringify(bodyType.startingEquipment ?? []),
      )];
    }

    if (operation.type === "bodyBackground.delete") {
      return [
        db.prepare(
          "UPDATE inventory_settings SET starting_body_background_id = NULL WHERE id = 1 AND starting_body_background_id = ?",
        ).bind(operation.id),
        db.prepare("DELETE FROM inventory_body_backgrounds WHERE id = ?").bind(operation.id),
      ];
    }

    if (operation.type === "bodyBackground.starting") {
      return [db.prepare(
        `INSERT INTO inventory_settings (id, starting_body_background_id)
         VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET starting_body_background_id=excluded.starting_body_background_id`,
      ).bind(operation.id)];
    }

    return null;
  },

  resetStatements(db) {
    return [
      resetHooksForKind(db, "item"),
      db.prepare("DELETE FROM item_definitions"),
      db.prepare("DELETE FROM inventory_settings"),
      db.prepare("DELETE FROM inventory_body_backgrounds"),
    ];
  },

  restoreOperations(snapshot) {
    return [
      ...(snapshot.bodyBackgrounds ?? []).map((background) => ({
        type: "bodyBackground.upsert" as const,
        background: {
          ...background,
          slots: background.slots ?? [],
          startingEquipment: background.startingEquipment ?? [],
        },
      })),
      { type: "bodyBackground.starting" as const, id: snapshot.startingBodyBackgroundId ?? null },
      ...snapshot.items.map((item) => ({
        type: "item.upsert" as const,
        item: {
          ...item,
          equipmentSlotKeys: item.equipmentSlotKeys ?? [],
          equippedStorage: item.equippedStorage ?? "inventory",
        },
      })),
    ];
  },
};
