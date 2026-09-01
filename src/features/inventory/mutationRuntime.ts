import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertItem: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "item.upsert") return;
  snapshot.items = upsertById(snapshot.items, operation.item);
};

export const INVENTORY_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "item.upsert": upsertItem,
};
