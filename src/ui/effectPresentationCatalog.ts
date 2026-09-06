import type { EffectEvent } from "../engine/rules/effectRuntime";
import type { EffectPresentationContext, EffectEventPresenter } from "../engine/presentation/effectPresentation";
import { presentMediaEffectEvent } from "../features/media/ui/effectPresentation";
import { presentRadixEffectEvent } from "../features/radix/ui/effectPresentation";
import { presentWorldEffectEvent } from "../features/world/ui/effectPresentation";

const presentCoreEffectEvent: EffectEventPresenter = (event, context) => {
  if (event.type !== "notification") return false;
  context.surface.notify(event.text, context.anchorLineId, event.source);
  return true;
};

/** Explicit browser-only composition root for core and installed feature presenters. */
const EFFECT_EVENT_PRESENTERS: readonly EffectEventPresenter[] = [
  presentCoreEffectEvent,
  presentMediaEffectEvent,
  presentRadixEffectEvent,
  presentWorldEffectEvent,
];

export function presentEffectEvent(event: EffectEvent, context: EffectPresentationContext) {
  for (const presenter of EFFECT_EVENT_PRESENTERS) {
    if (presenter(event, context)) return true;
  }
  return false;
}

export function presentEffectEvents(events: readonly EffectEvent[], context: EffectPresentationContext) {
  for (const event of events) presentEffectEvent(event, context);
}
