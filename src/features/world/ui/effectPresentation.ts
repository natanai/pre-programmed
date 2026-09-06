import type { EffectEventPresenter } from "../../../engine/presentation/effectPresentation";

/** World owns the meaning of Character portrait presentation; Media owns rendering the referenced asset. */
export const presentWorldEffectEvent: EffectEventPresenter = (event, context) => {
  if (event.type !== "world_portrait") return false;
  context.surface.showOverlayAsset(event.assetId, event.source);
  return true;
};
