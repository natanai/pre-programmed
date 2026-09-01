import type { ItemDefinition } from "../../src/features/inventory/model";
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
  tags_json: string;
  initial_state_json: string;
};

export const inventoryFeaturePersistence: WorkerFeaturePersistence = {
  id: "inventory",

  async load(db) {
    const [items, hookGroups] = await Promise.all([
      db.prepare(
        `SELECT id, key, name, description, asset_path, width, height, stackable,
                max_stack, removable, starting_quantity, operation_interactable, operations_json,
                tags_json, initial_state_json
           FROM item_definitions ORDER BY key`,
      ).all<ItemRow>(),
      loadHooksForKind(db, "item"),
    ]);

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
        tags: parseJson(row.tags_json, []),
        initialState: parseJson(row.initial_state_json, {}),
        hooks: hookGroups.get(row.id) ?? [],
      })),
    };
  },

  mutationStatements(db, operation) {
    if (operation.type !== "item.upsert") return null;
    const item = operation.item;
    return [
      db.prepare(
        `INSERT INTO item_definitions
         (id, key, name, description, asset_path, width, height, stackable, max_stack,
          removable, starting_quantity, operation_interactable, operations_json,
          tags_json, initial_state_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET key=excluded.key, name=excluded.name,
           description=excluded.description, asset_path=excluded.asset_path, width=excluded.width,
           height=excluded.height, stackable=excluded.stackable, max_stack=excluded.max_stack,
           removable=excluded.removable, starting_quantity=excluded.starting_quantity,
           operation_interactable=excluded.operation_interactable, operations_json=excluded.operations_json,
           tags_json=excluded.tags_json,
           initial_state_json=excluded.initial_state_json, updated_at=CURRENT_TIMESTAMP`,
      ).bind(
        item.id, item.key, item.name, item.description, item.assetPath, item.width, item.height,
        Number(item.stackable), item.maxStack, Number(item.removable), item.startingQuantity ?? 0,
        Number(item.interactable ?? true), JSON.stringify(item.operations ?? ["inspect", "use", "move", "remove"]),
        JSON.stringify(item.tags), JSON.stringify(item.initialState),
      ),
      ...hookStatements(db, "item", item.id, item.hooks),
    ];
  },

  resetStatements(db) {
    return [resetHooksForKind(db, "item"), db.prepare("DELETE FROM item_definitions")];
  },

  restoreOperations(snapshot) {
    return snapshot.items.map((item) => ({ type: "item.upsert" as const, item }));
  },
};
