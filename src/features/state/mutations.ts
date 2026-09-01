import type { ComputedDefinition, VariableDefinition } from "./model";

/** Project mutation payloads owned by the State feature. */
export type StateMutationOperation =
  | { type: "variable.upsert"; definition: VariableDefinition }
  | { type: "computed.upsert"; definition: ComputedDefinition };
