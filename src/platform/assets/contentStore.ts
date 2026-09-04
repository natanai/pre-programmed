import { ASSET_MANIFEST } from "../../generated/assetManifest";
import type { MediaAssetDescriptor } from "../../features/media/assets";
import type { MediaAsset } from "../../features/media/model";
import { assetUrl } from "../../data/assets";
import { ApiError, apiUrl } from "../cloudflare/http";

const repositoryEntryByAssetId = new Map(ASSET_MANIFEST.map((asset) => [asset.id, asset] as const));

function databaseContentUrl(contentKey: string) {
  return apiUrl(`/api/media/content/${encodeURIComponent(contentKey)}`);
}

async function responseError(response: Response, fallback: string) {
  const raw = await response.text();
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === "string") detail = parsed.error;
  } catch {}
  throw new ApiError(response.status, detail || fallback);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Browser Media content resolution boundary.
 *
 * - contentKey means Author-generated textual Media stored in D1.
 * - no contentKey means a version-controlled file discovered from public/assets.
 *
 * Durable Author-generated content is written only through Media's project
 * mutation contract. This browser port intentionally has no independent upload
 * path, so content and its Media definition cannot diverge.
 */
export const configuredAssetContentStore = {
  urlFor(asset: Pick<MediaAsset, "id" | "contentKey">) {
    if (asset.contentKey) return databaseContentUrl(asset.contentKey);
    const repositoryPath = repositoryEntryByAssetId.get(asset.id)?.runtimePath;
    return repositoryPath ? assetUrl(repositoryPath) : "";
  },

  hasRepository(assetId: string) {
    return repositoryEntryByAssetId.has(assetId);
  },

  repositoryMetadata(assetId: string) {
    const entry = repositoryEntryByAssetId.get(assetId);
    if (!entry) return null;
    return {
      mimeType: entry.mimeType,
      byteLength: entry.byteLength,
      intrinsicWidth: entry.dimensions?.width ?? null,
      intrinsicHeight: entry.dimensions?.height ?? null,
      authoringMode: entry.authoringMode,
    };
  },

  async fetch(asset: Pick<MediaAsset, "id" | "contentKey">) {
    const url = this.urlFor(asset);
    if (!url) throw new Error("This asset has no available content. Add its repository file or repair the Media reference.");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) await responseError(response, `Asset content unavailable (${response.status}).`);
    return response.blob();
  },

  async exportAsset(asset: MediaAssetDescriptor) {
    if (!asset.available) throw new Error("Missing Media content cannot be exported.");
    const content = await this.fetch(asset);
    downloadBlob(content, asset.name);
    const sidecarName = `${asset.name}.asset.json`;
    const sidecar = new Blob([JSON.stringify({
      id: asset.id,
      name: asset.name,
      defaultPresentation: asset.defaultPresentation,
      authoringMode: asset.authoringMode,
    }, null, 2)], { type: "application/json" });
    window.setTimeout(() => downloadBlob(sidecar, sidecarName), 50);
  },
};