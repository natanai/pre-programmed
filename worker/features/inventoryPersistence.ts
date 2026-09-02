import type { ItemDefinition, ItemInventoryLayout } from "../../src/features/inventory/model";
import { parseJson } from "../db/json";
import { hookStatements, loadHooksForKind, resetHooksForKind } from "./operationHooks";
import type { WorkerFeaturePersistence } from "./types";

type ItemRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  asset_id: string;
  stackable: number;
  max_stack: number;
  removable: number;
  starting_quantity: number;
  operation_interactable: number;
  operations_json: string;
  tags_json: string;
  initial_state_json: string;
};
type PresentationRow = { mode: "list" | "grid"; columns_count: number; rows_count: number };
type LayoutRow = { item_id: string; width: number; height: number };

export const inventoryFeaturePersistence: WorkerFeaturePersistence = {
  id: "inventory",
  restoreOrder: 10,
  resetOrder: 20,
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
      id: 23,
      name: "inventory-possession-layout-separation",
      sql: `
        CREATE TABLE IF NOT EXISTS inventory_presentation (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mode TEXT NOT NULL CHECK (mode IN ('list', 'grid')),
          columns_count INTEGER NOT NULL DEFAULT 10,
          rows_count INTEGER NOT NULL DEFAULT 6,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO inventory_presentation (id, mode, columns_count, rows_count)
        SELECT 1, CASE WHEN EXISTS (SELECT 1 FROM item_definitions) THEN 'grid' ELSE 'list' END, 10, 6;

        CREATE TABLE IF NOT EXISTS inventory_item_layouts (
          item_id TEXT PRIMARY KEY REFERENCES item_definitions(id) ON DELETE CASCADE,
          width INTEGER NOT NULL DEFAULT 1,
          height INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO inventory_item_layouts (item_id, width, height)
        SELECT id, max(1, width), max(1, height) FROM item_definitions;

        UPDATE project_meta SET schema_version = 23 WHERE id = 1;
      `,
    },
    {
      id: 26,
      name: "inventory-drop-prototype-item-columns",
      sql: `
        CREATE TABLE inventory_item_layouts_v26 AS
        SELECT item_id, width, height, updated_at FROM inventory_item_layouts;

        CREATE TABLE equipment_item_rules_v26 AS
        SELECT item_id, slot_keys_json, storage, equip_on_give_slot_key, updated_at FROM equipment_item_rules;

        DROP TABLE inventory_item_layouts;
        DROP TABLE equipment_item_rules;

        CREATE TABLE item_definitions_v26 (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          asset_id TEXT NOT NULL DEFAULT '',
          stackable INTEGER NOT NULL DEFAULT 0 CHECK (stackable IN (0, 1)),
          max_stack INTEGER NOT NULL DEFAULT 1 CHECK (max_stack >= 1),
          removable INTEGER NOT NULL DEFAULT 1 CHECK (removable IN (0, 1)),
          starting_quantity INTEGER NOT NULL DEFAULT 0 CHECK (starting_quantity >= 0),
          operation_interactable INTEGER NOT NULL DEFAULT 1 CHECK (operation_interactable IN (0, 1)),
          operations_json TEXT NOT NULL DEFAULT '["inspect","use","remove"]',
          tags_json TEXT NOT NULL DEFAULT '[]',
          initial_state_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO item_definitions_v26
          (id, key, name, description, asset_id, stackable, max_stack, removable, starting_quantity,
           operation_interactable, operations_json, tags_json, initial_state_json, updated_at)
        SELECT id, key, name, description, asset_id, stackable, max_stack, removable, starting_quantity,
               operation_interactable, operations_json, tags_json, initial_state_json, updated_at
        FROM item_definitions;

        DROP TABLE item_definitions;
        ALTER TABLE item_definitions_v26 RENAME TO item_definitions;

        CREATE TABLE inventory_item_layouts (
          item_id TEXT PRIMARY KEY REFERENCES item_definitions(id) ON DELETE CASCADE,
          width INTEGER NOT NULL DEFAULT 1,
          height INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO inventory_item_layouts (item_id, width, height, updated_at)
        SELECT item_id, width, height, updated_at FROM inventory_item_layouts_v26;
        DROP TABLE inventory_item_layouts_v26;

        CREATE TABLE equipment_item_rules (
          item_id TEXT PRIMARY KEY REFERENCES item_definitions(id) ON DELETE CASCADE,
          slot_keys_json TEXT NOT NULL DEFAULT '[]',
          storage TEXT NOT NULL DEFAULT 'inventory' CHECK (storage IN ('inventory', 'slot')),
          equip_on_give_slot_key TEXT,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO equipment_item_rules (item_id, slot_keys_json, storage, equip_on_give_slot_key, updated_at)
        SELECT item_id, slot_keys_json, storage, equip_on_give_slot_key, updated_at FROM equipment_item_rules_v26;
        DROP TABLE equipment_item_rules_v26;

        UPDATE project_meta SET schema_version = 26 WHERE id = 1;
      `,
    },
  ],

  async load(db) {
    const [items, hooks, presentation, layouts] = await Promise.all([
      db.prepare(`SELECT id, key, name, description, asset_id, stackable, max_stack, removable, starting_quantity,
        operation_interactable, operations_json, tags_json, initial_state_json FROM item_definitions ORDER BY key`).all<ItemRow>(),
      loadHooksForKind(db, "item"),
      db.prepare("SELECT mode, columns_count, rows_count FROM inventory_presentation WHERE id = 1").first<PresentationRow>(),
      db.prepare("SELECT item_id, width, height FROM inventory_item_layouts ORDER BY item_id").all<LayoutRow>(),
    ]);

    return {
      items: items.results.map((row): ItemDefinition => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        assetId: row.asset_id,
        stackable: Boolean(row.stackable),
        maxStack: row.max_stack,
        removable: Boolean(row.removable),
        startingQuantity: row.starting_quantity,
        interactable: Boolean(row.operation_interactable),
        operations: parseJson(row.operations_json, ["inspect", "use", "remove"]),
        tags: parseJson(row.tags_json, []),
        initialState: parseJson(row.initial_state_json, {}),
        hooks: hooks.get(row.id) ?? [],
      })),
      inventoryPresentation: presentation?.mode === "list"
        ? { mode: "list" as const }
        : { mode: "grid" as const, columns: presentation?.columns_count ?? 10, rows: presentation?.rows_count ?? 6 },
      itemInventoryLayouts: layouts.results.map((row): ItemInventoryLayout => ({
        itemId: row.item_id,
        width: row.width,
        height: row.height,
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type === "item.upsert") {
      const item = operation.item;
      return [
        db.prepare(`INSERT INTO item_definitions
          (id, key, name, description, asset_id, stackable, max_stack, removable, starting_quantity,
           operation_interactable, operations_json, tags_json, initial_state_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET key=excluded.key, name=excluded.name, description=excluded.description,
            asset_id=excluded.asset_id, stackable=excluded.stackable, max_stack=excluded.max_stack,
            removable=excluded.removable, starting_quantity=excluded.starting_quantity,
            operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
            tags_json=excluded.tags_json, initial_state_json=excluded.initial_state_json,
            updated_at=CURRENT_TIMESTAMP`)
          .bind(
            item.id,
            item.key,
            item.name,
            item.description,
            item.assetId ?? "",
            Number(item.stackable),
            item.maxStack,
            Number(item.removable),
            item.startingQuantity ?? 0,
            Number(item.interactable ?? true),
            JSON.stringify(item.operations ?? []),
            JSON.stringify(item.tags ?? []),
            JSON.stringify(item.initialState ?? {}),
          ),
        ...hookStatements(db, "item", item.id, item.hooks ?? []),
      ];
    }

    if (operation.type === "item.delete") return [
      db.prepare("DELETE FROM operation_hooks WHERE target_kind = 'item' AND target_id = ?").bind(operation.id),
      db.prepare("DELETE FROM item_definitions WHERE id = ?").bind(operation.id),
    ];

    if (operation.type === "itemInventoryLayout.upsert") {
      const layout = operation.layout;
      return [db.prepare(`INSERT INTO inventory_item_layouts (item_id, width, height, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(item_id) DO UPDATE SET width=excluded.width, height=excluded.height, updated_at=CURRENT_TIMESTAMP`)
        .bind(layout.itemId, layout.width, layout.height)];
    }

    if (operation.type === "inventoryPresentation.upsert") {
      const presentation = operation.presentation;
      return [db.prepare(`INSERT INTO inventory_presentation (id, mode, columns_count, rows_count, updated_at)
        VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET mode=excluded.mode, columns_count=excluded.columns_count,
          rows_count=excluded.rows_count, updated_at=CURRENT_TIMESTAMP`)
        .bind(
          presentation.mode,
          presentation.mode === "grid" ? presentation.columns : 10,
          presentation.mode === "grid" ? presentation.rows : 6,
        )];
    }

    return null;
  },

  resetStatements(db) {
    return [
      resetHooksForKind(db, "item"),
      db.prepare("DELETE FROM inventory_item_layouts"),
      db.prepare("DELETE FROM inventory_presentation"),
      db.prepare("DELETE FROM item_definitions"),
    ];
  },

  restoreOperations(snapshot) {
    return [
      { type: "inventoryPresentation.upsert" as const, presentation: snapshot.inventoryPresentation },
      ...snapshot.items.flatMap((item) => [
        { type: "item.upsert" as const, item },
        {
          type: "itemInventoryLayout.upsert" as const,
          layout: snapshot.itemInventoryLayouts.find((layout) => layout.itemId === item.id)
            ?? { itemId: item.id, width: 1, height: 1 },
        },
      ]),
    ];
  },
};
