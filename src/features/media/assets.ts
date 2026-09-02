import type { ProjectSnapshot } from "../../engine/project/model";
import type { MediaAsset, MediaAssetKind } from "./model";

export type MediaAssetDescriptor = {
  id: string;
  name: string;
  kind: MediaAssetKind;
  source: "repository" | "embedded";
  url: string;
  size: number;
  width: number | null;
  height: number | null;
};

export type MediaAssetImport = {
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
  width?: number | null;
  height?: number | null;
};

/** Platform-neutral port for stable media references. */
export interface AssetStore {
  list(snapshot: ProjectSnapshot, kind?: MediaAssetKind): MediaAssetDescriptor[];
  resolve(snapshot: ProjectSnapshot, assetId: string): MediaAssetDescriptor | null;
  createEmbedded(input: MediaAssetImport): MediaAsset;
}

export function embeddedDescriptor(asset: MediaAsset): MediaAssetDescriptor {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    source: asset.source,
    url: asset.dataUrl,
    size: asset.size,
    width: asset.width,
    height: asset.height,
  };
}

export function createEmbeddedAsset(input: MediaAssetImport): MediaAsset {
  const kind: MediaAssetKind = input.mimeType.startsWith("image/") ? "image" : "audio";
  return {
    id: crypto.randomUUID(),
    name: input.name,
    kind,
    source: "embedded",
    dataUrl: input.dataUrl,
    mimeType: input.mimeType,
    size: input.size,
    width: input.width ?? null,
    height: input.height ?? null,
  };
}
