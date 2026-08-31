import type { Condition, Effect } from "../../engine/rules/model";

/** Stable string identifier contributed by a feature, e.g. inspect/equip/attack. */
export type OperationId = string;

/** Source-compatible name for the prototype's original Inventory operation set. */
export type InventoryOperation = "inspect" | "use" | "move" | "remove";

export type OperationHook = {
  id: string;
  operation: OperationId;
  order: number;
  condition: Condition;
  responseText: string;
  effects: Effect[];
  success: boolean;
};

/** Retained as a source-compatible name for existing item authoring code. */
export type ItemOperationHook = OperationHook;

/**
 * Runtime operation target. Feature adapters own the meaning of each kind.
 * Keeping the transport shape generic lets Equipment/Combat add target kinds
 * without expanding a central discriminated union.
 */
export type OperationTarget = {
  kind: string;
  id: string;
};
