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

const upsertStateGroup: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "stateGroup.upsert") return;
  snapshot.stateGroups = upsertById(snapshot.stateGroups, operation.group);
};

const deleteStateGroup: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "stateGroup.delete") return;
  snapshot.stateGroups = snapshot.stateGroups.filter((group) => group.id !== operation.id);
  snapshot.variables = snapshot.variables.map((definition) => definition.playerPresentation?.groupId === operation.id
    ? { ...definition, playerPresentation: null }
    : definition);
  snapshot.computedValues = snapshot.computedValues.map((definition) => definition.playerPresentation?.groupId === operation.id
    ? { ...definition, playerPresentation: null }
    : definition);
};

export const STATE_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "variable.upsert": upsertVariable,
  "computed.upsert": upsertComputed,
  "stateGroup.upsert": upsertStateGroup,
  "stateGroup.delete": deleteStateGroup,
};
