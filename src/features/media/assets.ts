import type { ProjectSnapshot } from "../../engine/project/model";
import type {
  MediaAsset,
  MediaAssetAuthoringMode,
  MediaAssetKind,
  MediaAssetPresentation,
} from "./model";

export type MediaAssetDescriptor = MediaAsset & {
  /** Runtime-only browser handle. Never persisted into project data. */
  url: string;
  editable: boolean;
};

export type MediaAssetImport = {
  id?: string;
  name: string;
  mimeType: string;
  contentKey: string | null;
  byteLength: number;
  intrinsicWidth?: number | null;
  intrinsicHeight?: number | null;
  defaultPresentation?: MediaAssetPresentation;
  authoringMode?: MediaAssetAuthoringMode;
};

/** Browser-facing catalog port for stable media references. */
export interface AssetStore {
  list(snapshot: ProjectSnapshot, kind?: MediaAssetKind): MediaAssetDescriptor[];
  resolve(snapshot: ProjectSnapshot, assetId: string): MediaAssetDescriptor | null;
}

export function mediaKindForMimeType(mimeType: string): MediaAssetKind {
  return mimeType.toLowerCase().startsWith("audio/") ? "audio" : "image";
}

export function createMediaAsset(input: MediaAssetImport): MediaAsset {
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    kind: mediaKindForMimeType(input.mimeType),
    mimeType: input.mimeType,
    contentKey: input.contentKey,
    byteLength: input.byteLength,
    intrinsicWidth: input.intrinsicWidth ?? null,
    intrinsicHeight: input.intrinsicHeight ?? null,
    defaultPresentation: input.defaultPresentation ?? "overlay",
    authoringMode: input.authoringMode ?? "file",
  };
}
