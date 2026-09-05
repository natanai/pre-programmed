import type { ComputedDefinition, StateGroupDefinition, VariableDefinition } from "./model";
import type { Value } from "../../engine/rules/model";

export type StateProjectSlice = {
  variables: VariableDefinition[];
  computedValues: ComputedDefinition[];
  stateGroups: StateGroupDefinition[];
};

/**
 * Runtime values that are intentionally scoped below the project/global level.
 *
 * The container is generalized now so later scoped value types can reuse the
 * same play-state contract. Only boolean Node-local flags are authorable today.
 * Optionality keeps older browser/file saves source-compatible until normal
 * play-state reconciliation fills the current shape.
 */
export type ScopedStateValues = {
  node: Record<string, Record<string, Value>>;
};

export type StatePlayStateSlice = {
  values: Record<string, Value>;
  variableTimeUpdatedAt: number;
  scopedValues?: ScopedStateValues;
};
