/** Browser/runtime presentation events emitted by Media-owned effects. */
export type MediaEffectEvent =
  | { type: "synth"; synthId: string }
  | { type: "audio"; assetId: string }
  | { type: "art"; assetId: string };
