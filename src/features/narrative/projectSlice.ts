import type { GameNode, Interaction } from "./model";

export type NarrativeProjectSlice = {
  startNodeId: string;
  nodes: GameNode[];
  interactions: Interaction[];
};

export type NarrativePlayStateSlice = {
  currentNodeId: string;
  traversal: string[];
  attempts: Record<string, number>;
  visitedNodeIds: string[];
  /** Per-run show/hide overrides for suggested player choices; never controls typed recognition. */
  interactionVisibility: Record<string, boolean>;
};
