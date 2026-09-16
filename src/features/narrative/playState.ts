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
