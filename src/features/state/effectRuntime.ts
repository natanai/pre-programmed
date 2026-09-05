import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import type { Value } from "../../engine/rules/model";
import { isRuntimeBinding, resolveValueSource } from "../../engine/rules/runtimeBindings";
import type { VariableDefinition } from "./model";

function numericValue(value: Value | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function coerceBoundValue(value: Value, definition: VariableDefinition | undefined): Value | undefined {
  if (!definition) return value;
  switch (definition.valueType) {
    case "string":
      return value === null ? "" : String(value);
    case "number": {
      if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
      if (typeof value !== "string" || !value.trim()) return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      if (typeof value !== "string") return undefined;
      if (value.trim().toLocaleLowerCase() === "true") return true;
      if (value.trim().toLocaleLowerCase() === "false") return false;
      return undefined;
  }
}

const setFlag: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "set_flag") return unchangedEffect(state);
  return { state: { ...state, values: { ...state.values, [effect.key]: true } }, events: [] };
};

const clearFlag: EffectHandler = (effect, _snapshot, state) => {
  if (effect.type !== "clear_flag") return unchangedEffect(state);
  return { state: { ...state, values: { ...state.values, [effect.key]: false } }, events: [] };
};

const setValue: EffectHandler = (effect, snapshot, state, context) => {
  if (effect.type !== "set_value") return unchangedEffect(state);
  const resolved = resolveValueSource(effect.value, context);
  if (resolved === undefined) return unchangedEffect(state);
  const definition = snapshot.variables.find((candidate) => candidate.key === effect.key);
  const value = isRuntimeBinding(effect.value) ? coerceBoundValue(resolved, definition) : resolved;
  if (value === undefined) return unchangedEffect(state);
  return { state: { ...state, values: { ...state.values, [effect.key]: value } }, events: [] };
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
