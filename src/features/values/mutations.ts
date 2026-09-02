import type { DerivedValueDefinition, ValueDefinition } from "./model";

export type ValuesMutationOperation =
  | { type: "value.upsert"; definition: ValueDefinition }
  | { type: "derivedValue.upsert"; definition: DerivedValueDefinition };
