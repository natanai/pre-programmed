import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertGroup: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "statusGroup.upsert") return;
  snapshot.statusGroups = upsertById(snapshot.statusGroups, operation.group);
};
const upsertEntry: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "statusEntry.upsert") return;
  snapshot.statusEntries = upsertById(snapshot.statusEntries, operation.entry);
};

export const STATUS_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "statusGroup.upsert": upsertGroup,
  "statusEntry.upsert": upsertEntry,
};
