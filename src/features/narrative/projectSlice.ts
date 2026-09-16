import type { GameNode, Interaction } from "./model";

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
};
