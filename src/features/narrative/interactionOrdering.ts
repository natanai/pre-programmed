import type { ProjectSnapshot } from "../../engine/project/model";
import {
  applySiblingOrder,
  moveSibling,
  nextSiblingOrder,
  orderedSiblings,
  type SiblingMoveDirection,
} from "../../engine/project/orderedSiblings";
import type { Interaction } from "./model";

export function interactionsForNode(snapshot: ProjectSnapshot, nodeId: string): Interaction[] {
  return orderedSiblings(snapshot.interactions.filter((interaction) => interaction.sourceNodeId === nodeId));
}

export function validInteractionsForNode(snapshot: ProjectSnapshot, nodeId: string): Interaction[] {
  return orderedSiblings(
    snapshot.interactions.filter((interaction) => interaction.sourceNodeId === nodeId && interaction.matchMode !== "fallback"),
  );
}

export function nextInteractionOrder(snapshot: ProjectSnapshot, nodeId: string) {
  return nextSiblingOrder(validInteractionsForNode(snapshot, nodeId));
}

export function movedInteractionIds(
  snapshot: ProjectSnapshot,
  nodeId: string,
  interactionId: string,
  direction: SiblingMoveDirection,
) {
  return moveSibling(validInteractionsForNode(snapshot, nodeId), interactionId, direction).map((interaction) => interaction.id);
}

/** Apply the durable valid-input sequence while leaving fallback handling outside the ordered choice collection. */
export function applyInteractionOrder(
  interactions: readonly Interaction[],
  nodeId: string,
  orderedIds: readonly string[],
): Interaction[] {
  const siblings = interactions.filter((interaction) => interaction.sourceNodeId === nodeId && interaction.matchMode !== "fallback");
  const ordered = applySiblingOrder(siblings, orderedIds);
  const orderById = new Map(ordered.map((interaction) => [interaction.id, interaction.order]));
  return interactions.map((interaction) => {
    const order = orderById.get(interaction.id);
    return order === undefined ? interaction : { ...interaction, order };
  });
}
