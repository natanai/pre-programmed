import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import type { Value } from "../../engine/rules/model";

function numericValue(value: Value | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const setFlag: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "set_flag") return unchangedEffect(state);
  return { state: { ...state, values: { ...state.values, [effect.key]: true } }, events: [] };
};

const clearFlag: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "clear_flag") return unchangedEffect(state);
  return { state: { ...state, values: { ...state.values, [effect.key]: false } }, events: [] };
};

const setValue: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "set_value") return unchangedEffect(state);
  return { state: { ...state, values: { ...state.values, [effect.key]: effect.value } }, events: [] };
};

const increment: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "increment") return unchangedEffect(state);
  return {
    state: { ...state, values: { ...state.values, [effect.key]: numericValue(state.values[effect.key]) + effect.amount } },
    events: [],
  };
};

const decrement: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "decrement") return unchangedEffect(state);
  return {
    state: { ...state, values: { ...state.values, [effect.key]: numericValue(state.values[effect.key]) - effect.amount } },
    events: [],
  };
};

export const STATE_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  set_flag: setFlag,
  clear_flag: clearFlag,
  set_value: setValue,
  increment,
  decrement,
};
