import type { InventoryPresentation, ItemDefinition, ItemInventoryLayout } from "./model";

export type InventoryMutationOperation =
  | { type: "item.upsert"; item: ItemDefinition }
  | { type: "item.delete"; id: string }
  | { type: "itemInventoryLayout.upsert"; layout: ItemInventoryLayout }
  | { type: "inventoryPresentation.upsert"; presentation: InventoryPresentation };
