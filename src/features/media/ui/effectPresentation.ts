import type { EffectEventPresenter } from "../../../engine/presentation/effectPresentation";
import { configuredAssetStore } from "./assetStore";
import { playSynthSound } from "./synthPlayback";

function usesInlineArt(width: number | null, height: number | null) {
  return Boolean(width && height && width <= 32 && height <= 32);
}

/** Media owns the browser meaning of Media-generated effect events. */
export const presentMediaEffectEvent: EffectEventPresenter = (event, context) => {
  switch (event.type) {
    case "synth": {
      const sound = context.snapshot.synthSounds.find((candidate) => candidate.id === event.synthId);
      if (sound) void playSynthSound(sound);
      return true;
    }
    case "audio": {
      const asset = configuredAssetStore.resolve(context.snapshot, event.assetId);
      if (asset) void new Audio(asset.url).play().catch(() => undefined);
      return true;
    }
    case "art": {
      const asset = configuredAssetStore.resolve(context.snapshot, event.assetId);
      if (!asset) return true;
      if (usesInlineArt(asset.width, asset.height)) context.surface.appendInlineAsset(asset.url);
      else context.surface.showOverlayAsset(asset.url);
      return true;
    }
    default:
      return false;
  }
};
