import type { BodyBackgroundDefinition, BodyCanvasDefinition, BodySlotDefinition, ItemDefinition, StartingEquipmentDefinition } from "../../src/features/inventory/model";
import { DEFAULT_BODY_CANVAS, normalizeBodyTypeDefinition } from "../../src/features/inventory/bodyCanvas";
import { legacyAssetId } from "../../src/features/media/assetReference";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

type ItemRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  asset_id: string;
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
  equip_on_give_slot_key: string | null;
  tags_json: string;
  initial_state_json: string;
};

type BodyBackgroundRow = {
  id: string;
  name: string;
  asset_id: string;
  canvas_json: string;
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
    {
      id: 16,
      name: "inventory-equip-on-give",
      sql: `
        ALTER TABLE item_definitions
        ADD COLUMN equip_on_give_slot_key TEXT;

        UPDATE project_meta SET schema_version = 16 WHERE id = 1;
      `,
    },
    {
      id: 19,
      name: "inventory-stable-asset-references",
      sql: `
        ALTER TABLE item_definitions
        ADD COLUMN asset_id TEXT NOT NULL DEFAULT '';

        ALTER TABLE inventory_body_backgrounds
        ADD COLUMN asset_id TEXT NOT NULL DEFAULT '';

        UPDATE item_definitions
        SET asset_id = CASE WHEN asset_path = '' THEN '' ELSE 'repo:/' || ltrim(asset_path, '/') END;

        UPDATE inventory_body_backgrounds
        SET asset_id = CASE WHEN asset_path = '' THEN '' ELSE 'repo:/' || ltrim(asset_path, '/') END;

        UPDATE project_meta SET schema_version = 19 WHERE id = 1;
      `,
    },
    {
      id: 31,
      name: "inventory-body-logical-canvas",
      sql: `
        ALTER TABLE inventory_body_backgrounds
        ADD COLUMN canvas_json TEXT NOT NULL DEFAULT '{"width":48,"height":64,"fit":"contain"}';

        UPDATE inventory_body_backgrounds
        SET slots_json = COALESCE((
          SELECT json_group_array(json_object(
            'id', json_extract(value, '$.id'),
            'key', json_extract(value, '$.key'),
            'name', json_extract(value, '$.name'),
            'x', json_extract(value, '$.x') * 0.48,
            'y', json_extract(value, '$.y') * 0.64,
            'width', json_extract(value, '$.width') * 0.48,
            'height', json_extract(value, '$.height') * 0.64
          ))
          FROM json_each(inventory_body_backgrounds.slots_json)
        ), '[]');

        UPDATE project_meta SET schema_version = 31 WHERE id = 1;
      `,
    },
  ],

  async load(db) {
    const [items, hookGroups, backgrounds, settings] = await Promise.all([
      db.prepare(
        `SELECT id, key, name, description, asset_id, width, height, stackable,
                max_stack, removable, starting_quantity, operation_interactable, operations_json,
                equipment_slot_keys_json, equipped_storage, equip_on_give_slot_key, tags_json, initial_state_json
           FROM item_definitions ORDER BY key`,
      ).all<ItemRow>(),
      loadHooksForKind(db, "item"),
      db.prepare(
        "SELECT id, name, asset_id, canvas_json, slots_json, starting_equipment_json FROM inventory_body_backgrounds ORDER BY name, id",
      ).all<BodyBackgroundRow>(),
      db.prepare(
        "SELECT starting_body_background_id FROM inventory_settings WHERE id = 1",
      ).first<{ starting_body_background_id: string | null }>(),
    ]);

    const bodyBackgrounds = backgrounds.results.map((row): BodyBackgroundDefinition => normalizeBodyTypeDefinition({
      id: row.id,
      name: row.name,
      assetId: row.asset_id,
      canvas: parseJson<BodyCanvasDefinition>(row.canvas_json, { ...DEFAULT_BODY_CANVAS }),
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
        assetId: row.asset_id,
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
        equipOnGiveSlotKey: row.equip_on_give_slot_key,
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
      const legacyItem = item as typeof item & { assetPath?: string };
      const assetId = item.assetId ?? legacyAssetId(legacyItem.assetPath ?? "");
      return [
        db.prepare(
          `INSERT INTO item_definitions
           (id, key, name, description, asset_path, asset_id, width, height, stackable, max_stack,
            removable, starting_quantity, operation_interactable, operations_json,
            equipment_slot_keys_json, equipped_storage, equip_on_give_slot_key, tags_json, initial_state_json, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET key=excluded.key, name=excluded.name,
             description=excluded.description, asset_id=excluded.asset_id, width=excluded.width,
             height=excluded.height, stackable=excluded.stackable, max_stack=excluded.max_stack,
             removable=excluded.removable, starting_quantity=excluded.starting_quantity,
             operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
             equipment_slot_keys_json=excluded.equipment_slot_keys_json,
             equipped_storage=excluded.equipped_storage,
             equip_on_give_slot_key=excluded.equip_on_give_slot_key,
             tags_json=excluded.tags_json,
             initial_state_json=excluded.initial_state_json, updated_at=CURRENT_TIMESTAMP`,
        ).bind(
          item.id, item.key, item.name, item.description, assetId, item.width, item.height,
          Number(item.stackable), item.maxStack, Number(item.removable), item.startingQuantity ?? 0,
          Number(item.interactable ?? true), JSON.stringify(item.operations ?? ["inspect", "use", "move", "remove"]),
          JSON.stringify(item.equipmentSlotKeys ?? []), item.equippedStorage ?? "inventory", item.equipOnGiveSlotKey ?? null,
          JSON.stringify(item.tags), JSON.stringify(item.initialState),
        ),
        ...hookStatements(db, "item", item.id, item.hooks),
      ];
    }

    if (operation.type === "item.delete") {
      return [
        db.prepare("DELETE FROM operation_hooks WHERE target_kind = 'item' AND target_id = ?").bind(operation.id),
        db.prepare(
          `UPDATE inventory_body_backgrounds
              SET starting_equipment_json = COALESCE((
                SELECT json_group_array(json(value))
                  FROM json_each(inventory_body_backgrounds.starting_equipment_json)
                 WHERE json_extract(value, '$.itemId') <> ?
              ), '[]'),
                  updated_at = CURRENT_TIMESTAMP`,
        ).bind(operation.id),
        db.prepare("DELETE FROM item_definitions WHERE id = ?").bind(operation.id),
      ];
    }

    if (operation.type === "bodyBackground.upsert") {
      const bodyType = normalizeBodyTypeDefinition(operation.background);
      const legacyBodyType = bodyType as typeof bodyType & { assetPath?: string };
      const assetId = bodyType.assetId ?? legacyAssetId(legacyBodyType.assetPath ?? "");
      return [db.prepare(
        `INSERT INTO inventory_body_backgrounds (id, name, asset_path, asset_id, canvas_json, slots_json, starting_equipment_json, updated_at)
         VALUES (?, ?, '', ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, asset_id=excluded.asset_id,
           canvas_json=excluded.canvas_json, slots_json=excluded.slots_json, starting_equipment_json=excluded.starting_equipment_json,
           updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        bodyType.id,
        bodyType.name,
        assetId,
        JSON.stringify(bodyType.canvas),
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
        background: normalizeBodyTypeDefinition(background as Parameters<typeof normalizeBodyTypeDefinition>[0]),
      })),
      { type: "bodyBackground.starting" as const, id: snapshot.startingBodyBackgroundId ?? null },
      ...snapshot.items.map((item) => ({
        type: "item.upsert" as const,
        item: {
          ...item,
          equipmentSlotKeys: item.equipmentSlotKeys ?? [],
          equippedStorage: item.equippedStorage ?? "inventory",
          equipOnGiveSlotKey: item.equipOnGiveSlotKey ?? null,
        },
      })),
    ];
  },
};
