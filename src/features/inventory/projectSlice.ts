import type { BodyBackgroundDefinition, InventoryEntry, ItemDefinition } from "./model";

export type InventoryProjectSlice = {
  items: ItemDefinition[];
  bodyBackgrounds: BodyBackgroundDefinition[];
  startingBodyBackgroundId: string | null;
};

export type InventoryPlayStateSlice = {
  inventory: InventoryEntry[];
  bodyBackgroundId: string | null;
};
