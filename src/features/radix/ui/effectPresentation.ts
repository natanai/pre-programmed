import type { EffectEventPresenter } from "../../../engine/presentation/effectPresentation";

export const presentRadixEffectEvent: EffectEventPresenter = (event, context) => {
  if (event.type !== "radix") return false;
  context.surface.showRadixSequence(event.sequenceId, event.source);
  return true;
};
