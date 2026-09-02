import type { MediaAsset, SynthSound } from "./model";

/** Project mutation payloads owned by the Media feature. */
export type MediaMutationOperation =
  | { type: "synth.upsert"; sound: SynthSound }
  | { type: "synth.delete"; id: string }
  | { type: "mediaAsset.upsert"; asset: MediaAsset }
  | { type: "mediaAsset.delete"; id: string };
