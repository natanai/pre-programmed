import type { Value } from "../../engine/rules/model";
import type { OperationHook, OperationId } from "../operations/model";

/**
 * One authored way an item can sit on a body.
 *
 * The anchor is the slot the player chooses when equipping. occupiedSlotKeys is
 * the complete set reserved by that placement, including the anchor itself.
 * Keeping the resolved shape explicit supports asymmetric and symmetric gear
 * without teaching the runtime special cases such as "two handed".
 */
export type EquipmentPlacementDefinition = {
  anchorSlotKey: string;
  occupiedSlotKeys: string[];
};

/** Canonical runtime assignment for one equipped inventory instance. */
export type EquipmentAssignment = {
  anchorSlotKey: string;
  occupiedSlotKeys: string[];
};

export type ItemDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  assetId: string;
  width: number;
  height: number;
  stackable: boolean;
  maxStack: number;
  removable: boolean;
  startingQuantity: number;
  interactable: boolean;
  operations: OperationId[];
  /**
   * Explicit equipment placements. Empty/missing means any authored body slot
   * may be used as an anchor and only that chosen slot is occupied.
   */
  equipmentPlacements?: EquipmentPlacementDefinition[];
  /** Whether an equipped instance still occupies the inventory grid. */
  equippedStorage?: "inventory" | "slot";
  /** Stable anchor-slot key that a newly granted instance should equip to. */
  equipOnGiveSlotKey?: string | null;
  tags: string[];
  initialState: Record<string, Value>;
  hooks: OperationHook[];
};

export type StartingEquipmentDefinition = {
  /** Anchor slot for the item's authored equipment placement. */
  slotKey: string;
  itemId: string;
};

export type InventoryEntry = {
  instanceId: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  /** Null when carried; otherwise the complete body-slot reservation. */
  equipment?: EquipmentAssignment | null;
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
  assetId: string;
  /** Missing only on legacy snapshots created before body slots existed. */
  slots?: BodySlotDefinition[];
  /** Equipment drawn from authored starting quantities for a new playthrough. */
  startingEquipment?: StartingEquipmentDefinition[];
};

/** Source-compatible name retained while historical schema identifiers remain immutable. */
export type BodyBackgroundDefinition = BodyTypeDefinition;
