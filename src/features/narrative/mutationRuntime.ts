import { upsertById } from "../../engine/project/mutationHelpers";
import type { MutationHandler } from "../../engine/project/mutationRuntime";
import { applyInteractionOrder, nextInteractionOrder, validInteractionsForNode } from "./interactionOrdering";

const upsertNode: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "node.upsert") return;
  snapshot.nodes = upsertById(snapshot.nodes, operation.node);
};

const upsertInteraction: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "interaction.upsert") return;
  const existing = snapshot.interactions.find((interaction) => interaction.id === operation.interaction.id);
  const legacyExistingOrder = existing && existing.order === undefined
    ? validInteractionsForNode(snapshot, operation.interaction.sourceNodeId)
      .findIndex((interaction) => interaction.id === existing.id)
    : undefined;
  const interaction = {
    ...operation.interaction,
    order: existing?.order
      ?? (legacyExistingOrder !== undefined && legacyExistingOrder >= 0 ? legacyExistingOrder : undefined)
      ?? nextInteractionOrder(snapshot, operation.interaction.sourceNodeId),
  };
  snapshot.interactions = upsertById(snapshot.interactions, interaction);
};

const reorderInteractions: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "interaction.reorder") return;
  snapshot.interactions = applyInteractionOrder(snapshot.interactions, operation.sourceNodeId, operation.interactionIds);
};

const deleteInteraction: MutationHandler = (snapshot, operation) => {
  if (operation.type !== "interaction.delete") return;
  snapshot.interactions = snapshot.interactions.filter((interaction) => interaction.id !== operation.id);
};

export const NARRATIVE_MUTATION_HANDLERS: Readonly<Record<string, MutationHandler>> = {
  "node.upsert": upsertNode,
  "interaction.upsert": upsertInteraction,
  "interaction.reorder": reorderInteractions,
  "interaction.delete": deleteInteraction,
};
