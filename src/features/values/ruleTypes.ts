import type { ComparisonOperator, Value } from "../../engine/rules/primitives";

/** Serialized rule vocabulary retained because it describes durable game semantics, not the removed State feature. */
export type ValuesCondition =
  | { type: "flag"; key: string; value: boolean }
  | { type: "variable"; key: string; operator: ComparisonOperator; value: Value };

export type ValuesEffect =
  | { id: string; type: "set_flag"; key: string }
  | { id: string; type: "clear_flag"; key: string }
  | { id: string; type: "set_value"; key: string; value: Value }
  | { id: string; type: "increment"; key: string; amount: number }
  | { id: string; type: "decrement"; key: string; amount: number };
