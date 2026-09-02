import type { InventoryEntry, InventoryPosition, InventoryPresentation, ItemDefinition, ItemInventoryLayout } from "./model";

export type InventoryProjectSlice = {
  items: ItemDefinition[];
  inventoryPresentation: InventoryPresentation;
  itemInventoryLayouts: ItemInventoryLayout[];
};

export type InventoryPlayStateSlice = {
  inventory: InventoryEntry[];
  inventoryPositions: Record<string, InventoryPosition>;
};
