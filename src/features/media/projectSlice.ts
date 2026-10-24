import type { MediaAsset, SynthSound } from "./model";
import type { PremidiComposition } from "./vendor/premidi-schema.js";

export type MediaProjectSlice = {
  synthSounds: SynthSound[];
  mediaAssets: MediaAsset[];
  mediaCompositions?: PremidiComposition[];
};
