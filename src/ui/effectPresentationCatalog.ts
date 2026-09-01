import type { EffectEvent } from "../engine/rules/effectRuntime";
import type { EffectPresentationContext, EffectEventPresenter } from "../engine/presentation/effectPresentation";

const presentCoreEffectEvent: EffectEventPresenter = (event, context) => {
  if (event.type !== "notification") return false;
  context.surface.notify(event.text, context.anchorLineId);
  return true;
};

const EFFECT_EVENT_PRESENTERS: readonly EffectEventPresenter[] = [presentCoreEffectEvent];

export function presentEffectEvent(event: EffectEvent, context: EffectPresentationContext) {
  for (const presenter of EFFECT_EVENT_PRESENTERS) {
    if (presenter(event, context)) return true;
  }
  return false;
}

export function presentEffectEvents(events: readonly EffectEvent[], context: EffectPresentationContext) {
  for (const event of events) presentEffectEvent(event, context);
}
