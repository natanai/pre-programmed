import { ASSET_MANIFEST, type AssetManifestEntry } from "../../generated/assetManifest";

declare global {
  interface Window {
    __PRE_PROGRAMMED_PORTABLE_ASSETS__?: AssetManifestEntry[];
  }
}

/**
 * One browser-facing view of file Media, regardless of whether files were
 * indexed at build time (hosted/repository) or by the portable desktop host.
 * Portable entries intentionally override matching bundled IDs so an author can
 * restore a file beside the executable without rewriting authored references.
 */
export function repositoryAssetManifest(): AssetManifestEntry[] {
  const entries = new Map<string, AssetManifestEntry>();
  for (const entry of ASSET_MANIFEST) entries.set(entry.id, entry);
  const portable = typeof window !== "undefined" && Array.isArray(window.__PRE_PROGRAMMED_PORTABLE_ASSETS__)
    ? window.__PRE_PROGRAMMED_PORTABLE_ASSETS__
    : [];
  for (const entry of portable) entries.set(entry.id, entry);
  return [...entries.values()];
}

export function repositoryAssetEntry(assetId: string) {
  return repositoryAssetManifest().find((entry) => entry.id === assetId) ?? null;
}
