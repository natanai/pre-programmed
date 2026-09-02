export type MediaEffect =
  | { id: string; type: "synth"; synthId: string }
  | { id: string; type: "audio"; assetId: string }
  | { id: string; type: "art"; assetId: string };
