import type { InventoryCondition, InventoryEffect } from "../../features/inventory/ruleTypes";
import type { NarrativeCondition, NarrativeEffect } from "../../features/narrative/ruleTypes";
import type { StateCondition, StateEffect } from "../../features/state/ruleTypes";
import type { ComparisonOperator, Value } from "./primitives";

export type { ComparisonOperator, Value } from "./primitives";

/** Recursive and runtime-generic conditions owned by Engine Rules itself. */
export type CoreCondition =
  | { type: "always" }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
  | { type: "attempt"; eventKey?: string; operator: ComparisonOperator; value: number }
  | { type: "state"; field: "currentNodeId" | "lastCommand"; operator: "eq" | "neq"; value: string };

/**
 * Explicit condition composition root. Leaf condition payloads live beside the
 * feature that owns their semantics; Engine Rules owns recursive composition.
 */
export type Condition =
  | CoreCondition
  | InventoryCondition
  | StateCondition
  | NarrativeCondition;

/**
 * Explicit effect composition root. Effect payloads live beside the feature
 * that owns their runtime semantics.
 */
export type Effect =
  | StateEffect
  | InventoryEffect
  | NarrativeEffect;

export const ALWAYS: Condition = { type: "always" };
