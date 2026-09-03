import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { AssetStore, MediaAssetContentSource, MediaAssetDescriptor } from "../assets";
import { normalizeMediaAssetAuthoringMode, type MediaAsset } from "../model";
import { configuredAssetContentStore } from "../../../platform/assets/contentStore";

const repositoryEntryByAssetId = new Map(ASSET_MANIFEST.map((entry) => [entry.id, entry] as const));

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

function contentSource(asset: MediaAsset): MediaAssetContentSource {
  if (asset.contentKey && asset.mimeType.toLowerCase() === "image/svg+xml") return "database";
  if (repositoryEntryByAssetId.has(asset.id)) return "repository";
  return "missing";
}

function descriptor(asset: MediaAsset, editable: boolean): MediaAssetDescriptor {
  const source = contentSource(asset);
  const runtimeAsset = source === "repository" && asset.contentKey
    ? { ...asset, contentKey: null }
    : asset;
  return {
    ...runtimeAsset,
    url: source === "missing" ? "" : configuredAssetContentStore.urlFor(runtimeAsset),
    contentSource: source,
    available: source !== "missing",
    editable,
  };
}

/**
 * One stable Media catalog with exactly two built-in content origins:
 * Author-generated vector SVG in D1 and version-controlled files in public/assets.
 * A metadata row without either origin is deliberately exposed as missing rather
 * than pretending that an unavailable blob provider will supply it.
 */
export const configuredAssetStore: AssetStore = {
  list(snapshot, kind) {
    const projectById = new Map((snapshot.mediaAssets ?? []).map((asset) => [asset.id, normalizeAsset(asset)] as const));
    const assets = new Map<string, MediaAssetDescriptor>();

    for (const entry of ASSET_MANIFEST) {
      const repository = repositoryAsset(entry);
      const project = projectById.get(entry.id);
      const projectUsesD1Svg = Boolean(project?.contentKey && project.mimeType.toLowerCase() === "image/svg+xml");
      const merged = project
        ? projectUsesD1Svg
          ? project
          : {
              ...project,
              contentKey: null,
              mimeType: repository.mimeType,
              byteLength: repository.byteLength,
              intrinsicWidth: repository.intrinsicWidth,
              intrinsicHeight: repository.intrinsicHeight,
              authoringMode: repository.authoringMode,
            }
        : repository;
      assets.set(entry.id, descriptor(merged, true));
    }

    // Keep orphaned metadata visible so Author mode can tell the author exactly
    // which stable ID needs a repository file instead of silently hiding the bug.
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