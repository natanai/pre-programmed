export type TextPerformance = {
  charactersPerSecond: number;
};

export type GameNode = {
  id: string;
  nodeNumber: number;
  text: string;
  performance: TextPerformance;
};

export type ProjectBootstrap = {
  startNode: GameNode;
  revision: number;
};

export const UNIVERSE_DRIVE_PROMPT = "U:\\>";
