import type { Value } from "../../engine/rules/model";
import type { DerivedValueDefinition, ValueDefinition } from "./model";

export type ValuesProjectSlice = {
  valueDefinitions: ValueDefinition[];
  derivedValueDefinitions: DerivedValueDefinition[];
};

export type ValuesPlayStateSlice = {
  values: Record<string, Value>;
  valueTimeUpdatedAt: number;
};
