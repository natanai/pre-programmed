import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { AssetStore, MediaAssetDescriptor } from "../assets";
import { normalizeMediaAssetAuthoringMode, type MediaAsset } from "../model";
import { configuredAssetContentStore } from "../../../platform/assets/contentStore";

function normalizeAsset(asset: MediaAsset | (Omit<MediaAsset, "authoringMode"> & { authoringMode: unknown })): MediaAsset {
  return { ...asset, authoringMode: normalizeMediaAssetAuthoringMode(asset.authoringMode) } as MediaAsset;
}

function repositoryAsset(entry: (typeof ASSET_MANIFEST)[number]): MediaAsset {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.type,
    mimeType: entry.mimeType,
    contentKey: null,
    byteLength: entry.byteLength,
    intrinsicWidth: entry.dimensions?.width ?? null,
    intrinsicHeight: entry.dimensions?.height ?? null,
    defaultPresentation: entry.defaultPresentation,
    authoringMode: normalizeMediaAssetAuthoringMode(entry.authoringMode),
  };
}

function descriptor(asset: MediaAsset, editable: boolean): MediaAssetDescriptor {
  return {
    ...asset,
    url: configuredAssetContentStore.urlFor(asset),
    editable,
  };
}

/** Browser composition of one stable asset catalog backed by project metadata and repository metadata. */
export const configuredAssetStore: AssetStore = {
  list(snapshot, kind) {
    const projectById = new Map((snapshot.mediaAssets ?? []).map((asset) => [asset.id, normalizeAsset(asset)] as const));
    const assets = new Map<string, MediaAssetDescriptor>();

    for (const entry of ASSET_MANIFEST) {
      const repository = repositoryAsset(entry);
      const project = projectById.get(entry.id);
      const merged = project
        ? project.contentKey
          // Hosted content is active, so its persisted content metadata remains authoritative.
          ? project
          // A null content key explicitly selects the repository copy; repository-derived
          // MIME/dimension/size metadata must then follow the shipped file.
          : {
              ...project,
              mimeType: repository.mimeType,
              byteLength: repository.byteLength,
              intrinsicWidth: repository.intrinsicWidth,
              intrinsicHeight: repository.intrinsicHeight,
              authoringMode: repository.authoringMode,
            }
        : repository;
      assets.set(entry.id, descriptor(merged, true));
    }

    for (const projectValue of snapshot.mediaAssets ?? []) {
      const project = normalizeAsset(projectValue);
      if (!assets.has(project.id)) assets.set(project.id, descriptor(project, true));
    }

    return [...assets.values()]
      .filter((asset) => !kind || asset.kind === kind)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  },

  resolve(snapshot, assetId) {
    return this.list(snapshot).find((asset) => asset.id === assetId) ?? null;
  },
};
