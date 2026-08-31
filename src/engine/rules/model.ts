export type Value = string | number | boolean | null;

export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

/**
 * Cross-feature rule contracts. These remain source-compatible while feature
 * evaluators/editors are moved behind registries in the next architecture pass.
 */
export type Condition =
  | { type: "always" }
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
  | { type: "has_item"; itemId: string; minimum?: number }
  | { type: "lacks_item"; itemId: string }
  | { type: "flag"; key: string; value: boolean }
  | { type: "variable"; key: string; operator: ComparisonOperator; value: Value }
  | { type: "attempt"; eventKey?: string; operator: ComparisonOperator; value: number }
  | { type: "visited"; nodeId: string; value: boolean }
  | { type: "state"; field: "currentNodeId" | "lastCommand"; operator: "eq" | "neq"; value: string };

export type Effect =
  | { id: string; type: "set_flag"; key: string }
  | { id: string; type: "clear_flag"; key: string }
  | { id: string; type: "set_value"; key: string; value: Value }
  | { id: string; type: "increment"; key: string; amount: number }
  | { id: string; type: "decrement"; key: string; amount: number }
  | { id: string; type: "give_item"; itemId: string; quantity: number }
  | { id: string; type: "remove_item"; itemId: string; quantity: number }
  | { id: string; type: "set_item_state"; itemId: string; key: string; value: Value }
  | { id: string; type: "set_interaction_visibility"; interactionId: string; visible: boolean }
  | { id: string; type: "notification"; text: string }
  | { id: string; type: "synth"; synthId: string }
  | { id: string; type: "audio"; assetPath: string }
  | { id: string; type: "art"; assetPath: string }
  | { id: string; type: "transition"; nodeId: string };

export const ALWAYS: Condition = { type: "always" };
