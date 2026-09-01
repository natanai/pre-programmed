import type { ItemDefinition } from "./model";

/** Project mutation payloads owned by the Inventory feature. */
export type InventoryMutationOperation =
  | { type: "item.upsert"; item: ItemDefinition };
