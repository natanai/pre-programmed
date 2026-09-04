import type { MediaAsset, SynthSound } from "./model";

export const MAX_GENERATED_MEDIA_BYTES = 1_000_000;

export type GeneratedMediaContent = {
  mimeType: "image/svg+xml";
  text: string;
};

/** Project mutation payloads owned by the Media feature. */
export type MediaMutationOperation =
  | { type: "synth.upsert"; sound: SynthSound }
  | { type: "synth.delete"; id: string }
  | { type: "mediaAsset.upsert"; asset: MediaAsset; generatedContent?: GeneratedMediaContent }
  | { type: "mediaAsset.delete"; id: string };
