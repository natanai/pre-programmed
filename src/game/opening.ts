export type TextPerformance = {
  charactersPerSecond: number;
};

export type GameNode = {
  id: string;
  nodeNumber: number;
  text: string;
  performance: TextPerformance;
};

export const OPENING_NODE: GameNode = {
  id: "00000000-0000-4000-8000-000000000001",
  nodeNumber: 1,
  text: "you are born",
  performance: {
    charactersPerSecond: 18,
  },
};

export const UNIVERSE_DRIVE_PROMPT = "U:\\>";
