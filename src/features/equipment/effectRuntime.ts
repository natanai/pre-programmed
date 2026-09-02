import { unchangedEffect, type EffectHandler } from "../../engine/rules/effectRuntime";
import { PRIMARY_POSSESSION_SERVICES } from "../../engine/possessions/servicesCatalog";
import { setActiveBodyType } from "./runtime";

const setBodyType: EffectHandler = (effect, snapshot, state) => {
  if (effect.type !== "set_body_background") return unchangedEffect(state);
  return { state: setActiveBodyType(snapshot, state, effect.backgroundId || null, PRIMARY_POSSESSION_SERVICES), events: [] };
};

export const EQUIPMENT_EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  set_body_background: setBodyType,
};
