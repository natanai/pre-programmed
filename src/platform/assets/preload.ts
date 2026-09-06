import type { ProjectSnapshot } from "../../engine/project/model";
import { configuredAssetStore } from "./configuredAssetStore";

const warmedImageUrls = new Set<string>();
const imageWarmups = new Map<string, Promise<void>>();

function warmImageUrl(url: string) {
  if (!url || warmedImageUrls.has(url) || typeof Image === "undefined") return Promise.resolve();
  const existing = imageWarmups.get(url);
  if (existing) return existing;

  const warmup = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve();
      void decoded.catch(() => undefined).then(() => {
        warmedImageUrls.add(url);
        resolve();
      });
    };
    image.onerror = () => resolve();
    image.src = url;
  }).finally(() => imageWarmups.delete(url));

  imageWarmups.set(url, warmup);
  return warmup;
}

/**
 * Resolve stable Media IDs through the canonical asset store and warm browser
 * image bytes/decoding without blocking the caller. Missing/non-image assets are
 * deliberately ignored so launch warmup never becomes a new failure path.
 */
export async function preloadImageAssets(snapshot: ProjectSnapshot, assetIds: readonly string[]) {
  await Promise.all(assetIds.map((assetId) => {
    const asset = configuredAssetStore.resolve(snapshot, assetId);
    return asset?.available && asset.kind === "image" && asset.url
      ? warmImageUrl(asset.url)
      : Promise.resolve();
  }));
}
