import type { ComputedDefinition, StateGroupDefinition, VariableDefinition } from "./model";
import type { Value } from "../../engine/rules/model";

export type StateProjectSlice = {
  variables: VariableDefinition[];
  computedValues: ComputedDefinition[];
  stateGroups: StateGroupDefinition[];
};

export type StatePlayStateSlice = {
  values: Record<string, Value>;
  variableTimeUpdatedAt: number;
};
