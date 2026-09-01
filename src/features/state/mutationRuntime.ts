import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertVariable: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "variable.upsert") return;
  snapshot.variables = upsertById(snapshot.variables, operation.definition);
};

const upsertComputed: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "computed.upsert") return;
  snapshot.computedValues = upsertById(snapshot.computedValues, operation.definition);
};

export const STATE_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "variable.upsert": upsertVariable,
  "computed.upsert": upsertComputed,
};
