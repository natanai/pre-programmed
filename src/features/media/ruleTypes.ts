export type MediaEffect =
  | { id: string; type: "synth"; synthId: string }
  | { id: string; type: "audio"; assetPath: string }
  | { id: string; type: "art"; assetPath: string };
