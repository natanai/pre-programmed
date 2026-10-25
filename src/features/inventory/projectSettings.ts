import type { ItemDefinition } from "./model";

export type ItemDefaults = Pick<ItemDefinition,
  "width" | "height" | "stackable" | "maxStack" | "removable" | "startingQuantity" | "interactable" | "equippedStorage">;
export type InventoryProjectSettingsSlice = { itemDefaults: ItemDefaults };
export const DEFAULT_ITEM_DEFAULTS: ItemDefaults = {
  width: 1, height: 1, stackable: false, maxStack: 1, removable: true,
  startingQuantity: 1, interactable: true, equippedStorage: "inventory",
};
export const DEFAULT_INVENTORY_PROJECT_SETTINGS: InventoryProjectSettingsSlice = {
  itemDefaults: { ...DEFAULT_ITEM_DEFAULTS },
};
export function normalizeInventoryProjectSettings(root: Record<string, unknown>): InventoryProjectSettingsSlice {
  const raw = root.itemDefaults && typeof root.itemDefaults === "object"
    ? root.itemDefaults as Record<string, unknown>
    : {};
  const bounded = (value: unknown, fallback: number, minimum: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(minimum, Math.min(9999, Math.round(value)))
      : fallback;
  const stackable = typeof raw.stackable === "boolean" ? raw.stackable : DEFAULT_ITEM_DEFAULTS.stackable;
  return {
    itemDefaults: {
      width: bounded(raw.width, 1, 1),
      height: bounded(raw.height, 1, 1),
      stackable,
      maxStack: stackable ? bounded(raw.maxStack, 1, 1) : 1,
      removable: typeof raw.removable === "boolean" ? raw.removable : DEFAULT_ITEM_DEFAULTS.removable,
      startingQuantity: bounded(raw.startingQuantity, 1, 0),
      interactable: typeof raw.interactable === "boolean" ? raw.interactable : DEFAULT_ITEM_DEFAULTS.interactable,
      equippedStorage: raw.equippedStorage === "slot" ? "slot" : "inventory",
    },
  };
}
