import type { InventoryEntry, ItemDefinition } from "./model";

export type InventoryProjectSlice = {
  items: ItemDefinition[];
};

export type InventoryPlayStateSlice = {
  inventory: InventoryEntry[];
};
