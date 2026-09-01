import type { InventoryCondition, InventoryEffect } from "../../features/inventory/ruleTypes";
import type { NarrativeCondition, NarrativeEffect } from "../../features/narrative/ruleTypes";
import type { StateCondition, StateEffect } from "../../features/state/ruleTypes";
import type { ComparisonOperator, Value } from "./primitives";

export type { ComparisonOperator, Value } from "./primitives";

export type CoreCondition =
  | { type: "always" }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
  | { type: "attempt"; eventKey?: string; operator: ComparisonOperator; value: number }
  | { type: "state"; field: "currentNodeId" | "lastCommand"; operator: "eq" | "neq"; value: string };

export type CoreEffect = { id: string; type: "notification"; text: string };

export type Condition =
  | CoreCondition
  | InventoryCondition
  | StateCondition
  | NarrativeCondition;

export type Effect =
  | CoreEffect
  | StateEffect
  | InventoryEffect
  | NarrativeEffect;

export const ALWAYS: Condition = { type: "always" };
