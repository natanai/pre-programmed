import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";

const upsertNode: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "node.upsert") return;
  snapshot.nodes = upsertById(snapshot.nodes, operation.node);
};

const upsertInteraction: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "interaction.upsert") return;
  snapshot.interactions = upsertById(snapshot.interactions, operation.interaction);
};

const deleteInteraction: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "interaction.delete") return;
  snapshot.interactions = snapshot.interactions.filter((interaction) => interaction.id !== operation.id);
};

export const NARRATIVE_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "node.upsert": upsertNode,
  "interaction.upsert": upsertInteraction,
  "interaction.delete": deleteInteraction,
};
