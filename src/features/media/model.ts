export type SynthStep = {
  active: boolean;
  note: string;
  volume: number;
};

export type SynthVoice = {
  waveform: "square" | "triangle" | "sawtooth" | "sine" | "noise";
  attack: number;
  release: number;
  steps: SynthStep[];
};

export type SynthSound = {
  id: string;
  key: string;
  label: string;
  tempo: number;
  loop: boolean;
  voices: SynthVoice[];
};

export type MediaAssetKind = "audio" | "image";
export type MediaAssetPresentation = "inline" | "overlay";
export type MediaAssetAuthoringMode = "file" | "grid32";

/**
 * Stable project identity and behavior for media. Content location is deliberately
 * absent: repository paths and hosted-object URLs belong to the platform resolver.
 */
export type MediaAsset = {
  id: string;
  name: string;
  kind: MediaAssetKind;
  mimeType: string;
  contentKey: string | null;
  byteLength: number;
  intrinsicWidth: number | null;
  intrinsicHeight: number | null;
  defaultPresentation: MediaAssetPresentation;
  authoringMode: MediaAssetAuthoringMode;
};

export function isVectorAsset(asset: Pick<MediaAsset, "kind" | "mimeType">) {
  return asset.kind === "image" && asset.mimeType.toLowerCase() === "image/svg+xml";
}
