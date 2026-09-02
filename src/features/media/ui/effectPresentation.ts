import type { EffectEventPresenter } from "../../../engine/presentation/effectPresentation";
import { configuredAssetStore } from "./assetStore";
import { playSynthSound } from "./synthPlayback";

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
      if (asset?.url) void new Audio(asset.url).play().catch(() => undefined);
      return true;
    }
    case "art": {
      const asset = configuredAssetStore.resolve(context.snapshot, event.assetId);
      if (!asset?.url) return true;
      if (asset.defaultPresentation === "inline") context.surface.appendInlineAsset(asset.url);
      else context.surface.showOverlayAsset(asset.url);
      return true;
    }
    default:
      return false;
  }
};
