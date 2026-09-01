import type { SynthSound } from "./model";

/** Project mutation payloads owned by the Media feature. */
export type MediaMutationOperation =
  | { type: "synth.upsert"; sound: SynthSound };
