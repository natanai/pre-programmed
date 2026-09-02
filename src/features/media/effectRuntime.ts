import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";

const synth: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "synth") return unchangedEffect(state);
  return { state, events: [{ type: "synth", synthId: effect.synthId }] };
};

const audio: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "audio") return unchangedEffect(state);
  return { state, events: [{ type: "audio", assetId: effect.assetId }] };
};

const art: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "art") return unchangedEffect(state);
  return { state, events: [{ type: "art", assetId: effect.assetId }] };
};

export const MEDIA_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  synth,
  audio,
  art,
};
