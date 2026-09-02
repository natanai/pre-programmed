import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import { assetUrl } from "../../../data/assets";
import {
  createEmbeddedAsset,
  embeddedDescriptor,
  type AssetStore,
  type MediaAssetDescriptor,
} from "../assets";

function repositoryAssets(): MediaAssetDescriptor[] {
  return ASSET_MANIFEST.filter((asset) => asset.runtimePath).map((asset) => ({
    id: `repo:${asset.runtimePath}`,
    name: asset.path.replace(/^public\/assets\//, ""),
    kind: asset.type,
    source: "repository",
    url: assetUrl(asset.runtimePath),
    size: asset.size,
    width: asset.dimensions?.width ?? null,
    height: asset.dimensions?.height ?? null,
  }));
}

/** Browser composition of read-only repository assets and portable project assets. */
export const configuredAssetStore: AssetStore = {
  list(snapshot, kind) {
    return [...repositoryAssets(), ...(snapshot.mediaAssets ?? []).map(embeddedDescriptor)]
      .filter((asset) => !kind || asset.kind === kind)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  },
  resolve(snapshot, assetId) {
    return this.list(snapshot).find((asset) => asset.id === assetId) ?? null;
  },
  createEmbedded: createEmbeddedAsset,
};
