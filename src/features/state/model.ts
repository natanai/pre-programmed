import type { Value } from "../../engine/rules/model";
import type { InventoryOperation, OperationHook } from "../operations/model";

export type VariableDefinition = {
  id: string;
  key: string;
  label: string;
  valueType: "number" | "boolean" | "string";
  initialValue: Value;
  showInStatus: boolean;
  interactable: boolean;
  operations: InventoryOperation[];
  hooks: OperationHook[];
  timeRate?: number;
  timeUnit?: "second" | "minute" | "hour";
};

export type ComputedSource =
  | "elapsed_seconds"
  | "commands_entered"
  | "inventory_slots_used"
  | "visited_nodes";

export type ComputedDefinition = {
  id: string;
  key: string;
  label: string;
  source: ComputedSource;
  format: "raw" | "integer" | "seconds";
  showInStatus: boolean;
  interactable: boolean;
  operations: InventoryOperation[];
  hooks: OperationHook[];
};
