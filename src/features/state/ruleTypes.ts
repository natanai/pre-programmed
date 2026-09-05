import type { ComparisonOperator, Value } from "../../engine/rules/primitives";
import type { ValueSource } from "../../engine/rules/runtimeBindings";

/** Missing/legacy scope means the existing project-global flag behavior. */
export type FlagScope = "global" | "node";

export type StateCondition =
  | { type: "flag"; key: string; value: boolean; scope?: FlagScope }
  | { type: "variable"; key: string; operator: ComparisonOperator; value: Value };

export type StateEffect =
  | { id: string; type: "set_flag"; key: string; scope?: FlagScope }
  | { id: string; type: "clear_flag"; key: string; scope?: FlagScope }
  | { id: string; type: "set_value"; key: string; value: ValueSource }
  | { id: string; type: "increment"; key: string; amount: number }
  | { id: string; type: "decrement"; key: string; amount: number };
