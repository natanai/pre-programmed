import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";

const notification: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "notification") return unchangedEffect(state);
  return { state, events: [{ type: "notification", text: effect.text }] };
};

const synth: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "synth") return unchangedEffect(state);
  return { state, events: [{ type: "synth", synthId: effect.synthId }] };
};

const audio: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "audio") return unchangedEffect(state);
  return { state, events: [{ type: "audio", assetPath: effect.assetPath }] };
};

const art: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "art") return unchangedEffect(state);
  return { state, events: [{ type: "art", assetPath: effect.assetPath }] };
};

export const MEDIA_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  notification,
  synth,
  audio,
  art,
};
