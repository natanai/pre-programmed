import type { PlayState, ProjectSnapshot } from "../../engine/project/model";

export function initializeNarrativePlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  return {
    ...state,
    currentNodeId: snapshot.startNodeId,
    currentNodeOpeningId: null,
    traversal: [snapshot.startNodeId],
    attempts: {},
    visitedNodeIds: [snapshot.startNodeId],
    interactionVisibility: {},
  };
}

/** Normalize durable run state at the Narrative lifecycle boundary. */
export function reconcileNarrativePlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const currentNode = snapshot.nodes.find((node) => node.id === state.currentNodeId);
  const openingId = typeof state.currentNodeOpeningId === "string"
    && currentNode?.openings.some((opening) => opening.id === state.currentNodeOpeningId)
    ? state.currentNodeOpeningId
    : null;
  return { ...state, currentNodeOpeningId: openingId };
}
