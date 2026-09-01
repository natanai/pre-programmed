import type { Value } from "../../engine/rules/primitives";
import type { ComputedDefinition, VariableDefinition } from "./model";

export type StateProjectSlice = {
  variables: VariableDefinition[];
  computedValues: ComputedDefinition[];
};

export type StatePlayStateSlice = {
  values: Record<string, Value>;
  variableTimeUpdatedAt: number;
};
