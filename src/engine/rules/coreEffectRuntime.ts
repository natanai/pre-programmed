import { unchangedEffect, type EffectHandler } from "./effectRuntime";

const notification: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "notification") return unchangedEffect(state);
  return { state, events: [{ type: "notification", text: effect.text }] };
};

export const CORE_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  notification,
};
