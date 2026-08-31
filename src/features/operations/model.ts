import type { Condition, Effect } from "../../engine/rules/model";

export type InventoryOperation = "inspect" | "use" | "move" | "remove";

export type OperationHook = {
  id: string;
  operation: InventoryOperation;
  order: number;
  condition: Condition;
  responseText: string;
  effects: Effect[];
  success: boolean;
};

/** Retained as a source-compatible name for existing item authoring code. */
export type ItemOperationHook = OperationHook;

export type OperationTarget =
  | { kind: "item"; id: string }
  | { kind: "variable"; id: string }
  | { kind: "computed"; id: string };
