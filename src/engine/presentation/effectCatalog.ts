import type { EffectEvent } from "../rules/effectRuntime";
import type { EffectPresentationContext, EffectEventPresenter } from "./effectPresentation";
import { presentMediaEffectEvent } from "../../features/media/ui/effectPresentation";

/** Explicit browser presentation composition root for installed features. */
const EFFECT_EVENT_PRESENTERS: readonly EffectEventPresenter[] = [
  presentMediaEffectEvent,
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
