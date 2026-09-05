import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";

const radix: EffectHandler = (effect, snapshot, state) => {
  if (effect.type !== "radix") return unchangedEffect(state);
  if (!snapshot.settings.radix.sequences.some((sequence) => sequence.id === effect.sequenceId)) return unchangedEffect(state);
  return { state, events: [{ type: "radix", sequenceId: effect.sequenceId }] };
};

export const RADIX_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  radix,
};
