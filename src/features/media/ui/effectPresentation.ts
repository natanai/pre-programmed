import { assetUrl } from "../../../data/assets";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import type { EffectEventPresenter } from "../../../engine/presentation/effectPresentation";
import { playSynthSound } from "./synthPlayback";

function usesInlineArt(assetPath: string) {
  const runtimePath = `/${assetPath.replace(/^\/+/, "")}`;
  const dimensions = ASSET_MANIFEST.find((asset) => asset.runtimePath === runtimePath)?.dimensions;
  return Boolean(dimensions && dimensions.width <= 32 && dimensions.height <= 32);
}

/** Media owns the browser meaning of Media-generated effect events. */
export const presentMediaEffectEvent: EffectEventPresenter = (event, context) => {
  switch (event.type) {
    case "synth": {
      const sound = context.snapshot.synthSounds.find((candidate) => candidate.id === event.synthId);
      if (sound) void playSynthSound(sound);
      return true;
    }
    case "audio":
      void new Audio(assetUrl(event.assetPath)).play().catch(() => undefined);
      return true;
    case "art":
      if (usesInlineArt(event.assetPath)) context.surface.appendInlineAsset(event.assetPath);
      else context.surface.showOverlayAsset(event.assetPath);
      return true;
    default:
      return false;
  }
};
