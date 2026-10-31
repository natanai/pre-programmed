import type { ProjectSnapshot } from "../../../engine/project/model";
import type { MediaAssetDescriptor } from "../assets";
import { configuredAssetStore } from "./assetStore";

/** Filesystem-scanned .premidi instructions, not a D1 music upload. */
export const PREMIDI_MIME = "audio/x-premidi";

export function isPremidiAsset(asset: Pick<MediaAssetDescriptor, "mimeType">): boolean {
  return asset.mimeType.toLowerCase() === PREMIDI_MIME;
}

export function repositoryPremidiAssets(snapshot: ProjectSnapshot): MediaAssetDescriptor[] {
  return configuredAssetStore.list(snapshot, "audio")
    .filter((asset) => asset.contentSource === "repository" && asset.available && isPremidiAsset(asset));
}
