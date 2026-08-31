import type { OperationHook, OperationId } from "../operations/model";

export type EntityDefinition = {
  id: string;
  key: string;
  type: "character" | "location";
  name: string;
  description: string;
  tags: string[];
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
};
