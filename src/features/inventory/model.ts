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
  state: Record<string, Value>;
};
