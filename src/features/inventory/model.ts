import type { Value } from "../../engine/rules/model";
import type { OperationHook, OperationId } from "../operations/model";

/** A thing that can be possessed. Spatial layout and equipment are separate concerns. */
export type ItemDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  assetId: string;
  stackable: boolean;
  maxStack: number;
  removable: boolean;
  startingQuantity: number;
  interactable: boolean;
  operations: OperationId[];
  tags: string[];
  initialState: Record<string, Value>;
  hooks: OperationHook[];
};

export type InventoryEntry = {
  instanceId: string;
  itemId: string;
  quantity: number;
  state: Record<string, Value>;
};

export type ItemInventoryLayout = {
  itemId: string;
  width: number;
  height: number;
};

export type InventoryPresentation =
  | { mode: "list" }
  | { mode: "grid"; columns: number; rows: number };

export type InventoryPosition = { x: number; y: number };
