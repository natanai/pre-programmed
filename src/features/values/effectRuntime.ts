import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import type { Value } from "../../engine/rules/model";

function numericValue(value: Value | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const setFlag: EffectHandler = (effect, _snapshot, state) => effect.type === "set_flag"
  ? { state: { ...state, values: { ...state.values, [effect.key]: true } }, events: [] }
  : unchangedEffect(state);
const clearFlag: EffectHandler = (effect, _snapshot, state) => effect.type === "clear_flag"
  ? { state: { ...state, values: { ...state.values, [effect.key]: false } }, events: [] }
  : unchangedEffect(state);
const setValue: EffectHandler = (effect, _snapshot, state) => effect.type === "set_value"
  ? { state: { ...state, values: { ...state.values, [effect.key]: effect.value } }, events: [] }
  : unchangedEffect(state);
const increment: EffectHandler = (effect, _snapshot, state) => effect.type === "increment"
  ? { state: { ...state, values: { ...state.values, [effect.key]: numericValue(state.values[effect.key]) + effect.amount } }, events: [] }
  : unchangedEffect(state);
const decrement: EffectHandler = (effect, _snapshot, state) => effect.type === "decrement"
  ? { state: { ...state, values: { ...state.values, [effect.key]: numericValue(state.values[effect.key]) - effect.amount } }, events: [] }
  : unchangedEffect(state);

export const VALUES_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  set_flag: setFlag,
  clear_flag: clearFlag,
  set_value: setValue,
  increment,
  decrement,
};
