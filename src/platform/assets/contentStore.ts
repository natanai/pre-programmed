import { ASSET_MANIFEST } from "../../generated/assetManifest";
import type { MediaAssetDescriptor } from "../../features/media/assets";
import type { MediaAsset } from "../../features/media/model";
import { assetUrl } from "../../data/assets";
import { ApiError, apiUrl } from "../cloudflare/http";

const repositoryEntryByAssetId = new Map(ASSET_MANIFEST.map((asset) => [asset.id, asset] as const));

function hostedContentUrl(contentKey: string) {
  return apiUrl(`/api/media/content/${encodeURIComponent(contentKey)}`);
}

async function responseError(response: Response, fallback: string) {
  const detail = await response.text();
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
 * Browser content port. Repository and hosted objects intentionally collapse to
 * the same URL-producing boundary; no caller stores either location in project data.
 */
export const configuredAssetContentStore = {
  urlFor(asset: Pick<MediaAsset, "id" | "contentKey">) {
    if (asset.contentKey) return hostedContentUrl(asset.contentKey);
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
    };
  },

  async upload(authorization: string, contentKey: string, content: Blob) {
    const response = await fetch(apiUrl(`/api/author/media/content/${encodeURIComponent(contentKey)}`), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authorization}`,
        "Content-Type": content.type || "application/octet-stream",
      },
      body: content,
    });
    if (!response.ok) await responseError(response, `Asset upload failed (${response.status}).`);
  },

  async fetch(asset: Pick<MediaAsset, "id" | "contentKey">) {
    const url = this.urlFor(asset);
    if (!url) throw new Error("This asset has no available content yet.");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) await responseError(response, `Asset content unavailable (${response.status}).`);
    return response.blob();
  },

  async exportAsset(asset: MediaAssetDescriptor) {
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
