import type { Value } from "../../engine/rules/model";
import type { OperationHook, OperationId } from "../operations/model";

export type ValueDefinition = {
  id: string;
  key: string;
  label: string;
  valueType: "number" | "boolean" | "string";
  initialValue: Value;
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
  timeRate?: number;
  timeUnit?: "second" | "minute" | "hour";
};

export type DerivedValueDefinition = {
  id: string;
  key: string;
  label: string;
  source: {
    provider: string;
    metric: string;
  };
  format: "raw" | "integer" | "seconds";
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
};
