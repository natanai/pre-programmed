import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertValue: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "value.upsert") return;
  snapshot.valueDefinitions = upsertById(snapshot.valueDefinitions, operation.definition);
};

const upsertDerivedValue: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "derivedValue.upsert") return;
  snapshot.derivedValueDefinitions = upsertById(snapshot.derivedValueDefinitions, operation.definition);
};

export const VALUES_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "value.upsert": upsertValue,
  "derivedValue.upsert": upsertDerivedValue,
};
