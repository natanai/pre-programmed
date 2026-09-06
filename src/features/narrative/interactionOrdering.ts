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

/**
 * Apply the durable valid-input sequence and also realign the flat snapshot array.
 * Existing consumers that filter the snapshot therefore inherit canonical order
 * without learning Narrative's ordering implementation.
 */
export function applyInteractionOrder(
  interactions: readonly Interaction[],
  nodeId: string,
  orderedIds: readonly string[],
): Interaction[] {
  const siblings = interactions.filter((interaction) => interaction.sourceNodeId === nodeId && interaction.matchMode !== "fallback");
  const ordered = applySiblingOrder(siblings, orderedIds);
  let siblingIndex = 0;

  return interactions.map((interaction) => {
    if (interaction.sourceNodeId !== nodeId || interaction.matchMode === "fallback") return interaction;
    const next = ordered[siblingIndex];
    siblingIndex += 1;
    return next ?? interaction;
  });
}
