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
  interactionVisibility: Record<string, boolean>;
};
