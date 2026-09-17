import type { GameNode, Interaction, NarrativeFlowOwner } from "./model";

export type NarrativeProjectSlice = {
  startNodeId: string;
  nodes: GameNode[];
  interactions: Interaction[];
};

export type NarrativePlayStateSlice = {
  currentNodeId: string;
  /** Specific opening requested by the transition that entered currentNodeId; null means AUTO. */
  currentNodeOpeningId: string | null;
  traversal: string[];
  attempts: Record<string, number>;
  visitedNodeIds: string[];
  /** Per-run show/hide overrides for suggested player choices; never controls typed recognition. */
  interactionVisibility: Record<string, boolean>;
  /**
   * Suspended Narrative continuation.
   * input waits for one player submission; auto resumes after the current
   * presentation finishes. Bindings are run-scoped data carried only while
   * this flow is executing.
   */
  pendingNarrativeFlow: {
    owner: NarrativeFlowOwner;
    stepIndex: number;
    mode: "input" | "auto";
    bindings: Record<string, string | number | boolean>;
  } | null;
};
