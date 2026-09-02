import type { EffectHandler } from "./effectRuntime";
import { CORE_EFFECT_HANDLERS } from "./coreEffectRuntime";
import { EQUIPMENT_EFFECT_HANDLERS } from "../../features/equipment/effectRuntime";
import { INVENTORY_EFFECT_HANDLERS } from "../../features/inventory/effectRuntime";
import { MEDIA_EFFECT_HANDLERS } from "../../features/media/effectRuntime";
import { NARRATIVE_EFFECT_HANDLERS } from "../../features/narrative/effectRuntime";
import { VALUES_EFFECT_HANDLERS } from "../../features/values/effectRuntime";

export const EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  ...CORE_EFFECT_HANDLERS,
  ...NARRATIVE_EFFECT_HANDLERS,
  ...VALUES_EFFECT_HANDLERS,
  ...INVENTORY_EFFECT_HANDLERS,
  ...EQUIPMENT_EFFECT_HANDLERS,
  ...MEDIA_EFFECT_HANDLERS,
};
