import type { Value } from "../../engine/rules/model";
import type { OperationHook, OperationId } from "../operations/model";

export type ItemDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  assetPath: string;
  width: number;
  height: number;
  stackable: boolean;
  maxStack: number;
  removable: boolean;
  startingQuantity: number;
  interactable: boolean;
  operations: OperationId[];
  /** Empty means the item may equip to any authored body-slot key. */
  equipmentSlotKeys: string[];
  tags: string[];
  initialState: Record<string, Value>;
  hooks: OperationHook[];
};

export type InventoryEntry = {
  instanceId: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  /** Stable slot key occupied on the current body type, or null when carried only. */
  equippedSlotKey?: string | null;
  state: Record<string, Value>;
};

export type BodySlotDefinition = {
  id: string;
  /** Stable across body types when equipment should carry between forms. */
  key: string;
  name: string;
  /** Percentage coordinates within the body canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Inventory-owned body/equipment layout. Historical persistence calls these
 * "body backgrounds"; at runtime each definition is a complete body type.
 */
export type BodyTypeDefinition = {
  id: string;
  name: string;
  assetPath: string;
  slots: BodySlotDefinition[];
};

/** Source-compatible name retained while historical schema identifiers remain immutable. */
export type BodyBackgroundDefinition = BodyTypeDefinition;
