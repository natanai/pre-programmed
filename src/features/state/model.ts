import type { Value } from "../../engine/rules/model";
import type { Condition } from "../../engine/rules/model";
import type { OperationHook, OperationId } from "../operations/model";

export type StateGroupDefinition = {
  id: string;
  label: string;
  order: number;
  visibleWhen: Condition;
};

export type StatePlayerPresentation = {
  groupId: string;
  order: number;
  visibleWhen: Condition;
};

export type VariableDefinition = {
  id: string;
  key: string;
  label: string;
  valueType: "number" | "boolean" | "string";
  initialValue: Value;
  /** Player presentation is optional; absence means this value is internal-only. */
  playerPresentation?: StatePlayerPresentation | null;
  interactable: boolean;
  operations: OperationId[];
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
  /** Player presentation is optional; absence means this value is internal-only. */
  playerPresentation?: StatePlayerPresentation | null;
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
};
