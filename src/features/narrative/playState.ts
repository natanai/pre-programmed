import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { NarrativeFlowOwner } from "./model";

function flowForOwner(snapshot: ProjectSnapshot, owner: NarrativeFlowOwner) {
  if (owner.type === "interaction-outcome") {
    return snapshot.interactions
      .find((interaction) => interaction.id === owner.interactionId)
      ?.outcomes.find((outcome) => outcome.id === owner.outcomeId)
      ?.after;
  }
  return snapshot.nodes
    .find((node) => node.id === owner.nodeId)
    ?.openings.find((opening) => opening.id === owner.openingId)
    ?.after;
}

export function initializeNarrativePlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  return {
    ...state,
    currentNodeId: snapshot.startNodeId,
    currentNodeOpeningId: null,
    traversal: [snapshot.startNodeId],
    attempts: {},
    visitedNodeIds: [snapshot.startNodeId],
    interactionVisibility: {},
    pendingNarrativeFlow: null,
  };
}

/** Normalize durable run state at the Narrative lifecycle boundary. */
export function reconcileNarrativePlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const currentNode = snapshot.nodes.find((node) => node.id === state.currentNodeId);
  const openingId = typeof state.currentNodeOpeningId === "string"
    && currentNode?.openings.some((opening) => opening.id === state.currentNodeOpeningId)
    ? state.currentNodeOpeningId
    : null;

  let pendingNarrativeFlow = state.pendingNarrativeFlow ?? null;

  // One-way player-save upgrade from the short-lived response inputCapture prototype.
  if (!pendingNarrativeFlow) {
    const historical = (state as unknown as {
      pendingInputCapture?: { interactionId?: unknown; outcomeId?: unknown } | null;
    }).pendingInputCapture;
    if (historical
      && typeof historical.interactionId === "string"
      && typeof historical.outcomeId === "string") {
      const owner: NarrativeFlowOwner = {
        type: "interaction-outcome",
        interactionId: historical.interactionId,
        outcomeId: historical.outcomeId,
      };
      const flow = flowForOwner(snapshot, owner);
      const awaitIndex = flow?.findIndex((step) => step.type === "await_input") ?? -1;
      if (awaitIndex >= 0) {
        pendingNarrativeFlow = {
          owner,
          stepIndex: awaitIndex,
          mode: "input",
          bindings: {},
        };
      }
    }
  }

  if (pendingNarrativeFlow) {
    const flow = flowForOwner(snapshot, pendingNarrativeFlow.owner);
    const step = flow?.[pendingNarrativeFlow.stepIndex];
    const valid = Boolean(
      flow
      && step
      && (pendingNarrativeFlow.mode === "auto" || step.type === "await_input"),
    );
    if (!valid) pendingNarrativeFlow = null;
  }

  const { pendingInputCapture: _historicalPendingInputCapture, ...canonical } = state as PlayState & {
    pendingInputCapture?: unknown;
  };
  return {
    ...canonical,
    currentNodeOpeningId: openingId,
    pendingNarrativeFlow,
  };
}
