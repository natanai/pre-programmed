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
export type MediaAssetAuthoringMode = "file" | "vector-grid";
export type MediaAssetDimensionUnit = "px" | "viewBox";

/**
 * Stable project identity and behavior for media. Content location is deliberately
 * absent: repository paths and hosted-object URLs belong to the platform resolver.
 *
 * `intrinsicWidth`/`intrinsicHeight` preserve the source asset's own coordinate
 * extent. Raster image dimensions are pixels; SVG dimensions describe its viewBox
 * coordinate space. Consumers that only need shape should use mediaAssetAspectRatio.
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

export type MediaAssetDimensions = {
  width: number;
  height: number;
  unit: MediaAssetDimensionUnit;
};

/** One-way compatibility boundary for browser caches and pre-migration rows. */
export function normalizeMediaAssetAuthoringMode(value: unknown): MediaAssetAuthoringMode {
  return value === "vector-grid" || value === "grid32" ? "vector-grid" : "file";
}

export function mediaAssetDimensions(asset: Pick<MediaAsset, "kind" | "mimeType" | "intrinsicWidth" | "intrinsicHeight">): MediaAssetDimensions | null {
  if (asset.kind !== "image"
    || typeof asset.intrinsicWidth !== "number"
    || typeof asset.intrinsicHeight !== "number"
    || !Number.isFinite(asset.intrinsicWidth)
    || !Number.isFinite(asset.intrinsicHeight)
    || asset.intrinsicWidth <= 0
    || asset.intrinsicHeight <= 0) return null;
  return {
    width: asset.intrinsicWidth,
    height: asset.intrinsicHeight,
    unit: asset.mimeType.toLowerCase() === "image/svg+xml" ? "viewBox" : "px",
  };
}

export function mediaAssetAspectRatio(asset: Pick<MediaAsset, "kind" | "mimeType" | "intrinsicWidth" | "intrinsicHeight">) {
  const dimensions = mediaAssetDimensions(asset);
  return dimensions ? dimensions.width / dimensions.height : null;
}

export function isVectorAsset(asset: Pick<MediaAsset, "kind" | "mimeType">) {
  return asset.kind === "image" && asset.mimeType.toLowerCase() === "image/svg+xml";
}
