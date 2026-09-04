import type { EffectEventPresenter } from "../../../engine/presentation/effectPresentation";
import { configuredAssetStore } from "./assetStore";
import { playSynthSound } from "./synthPlayback";

function reportMissingSound(id: string) {
  console.warn(`[MEDIA] Sound ${id} has no playable synth or repository file.`);
}

function findSynth(context: Parameters<EffectEventPresenter>[1], reference: string) {
  return context.snapshot.synthSounds.find((candidate) => candidate.id === reference || candidate.key === reference);
}

/** Media owns the browser meaning of Media-generated effect events. */
export const presentMediaEffectEvent: EffectEventPresenter = (event, context) => {
  switch (event.type) {
    case "synth": {
      const sound = findSynth(context, event.synthId);
      if (sound) void playSynthSound(sound).catch((error) => console.warn(`[MEDIA] Synth ${event.synthId} could not play.`, error));
      else reportMissingSound(event.synthId);
      return true;
    }
    case "audio": {
      // "audio" is the persisted prototype effect name; its stable reference now resolves
      // against the single author-facing sound catalog: D1 synths first, then files.
      const synth = findSynth(context, event.assetId);
      if (synth) {
        void playSynthSound(synth).catch((error) => console.warn(`[MEDIA] Synth ${event.assetId} could not play.`, error));
        return true;
      }

      const asset = configuredAssetStore.resolve(context.snapshot, event.assetId);
      if (!asset?.available || !asset.url) {
        reportMissingSound(event.assetId);
        return true;
      }
      void new Audio(asset.url).play().catch((error) => console.warn(`[MEDIA] Audio ${event.assetId} could not play.`, error));
      return true;
    }
    case "art": {
      const asset = configuredAssetStore.resolve(context.snapshot, event.assetId);
      if (!asset?.available || !asset.url) {
        console.warn(`[MEDIA] Image ${event.assetId} has no renderable content.`);
        return true;
      }
      if (asset.defaultPresentation === "inline") context.surface.appendInlineAsset(event.assetId, event.source);
      else context.surface.showOverlayAsset(event.assetId, event.source);
      return true;
    }
    default:
      return false;
  }
};
