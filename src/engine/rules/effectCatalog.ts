import type { EffectHandler } from "./effectRuntime";
import { INVENTORY_EFFECT_HANDLERS } from "../../features/inventory/effectRuntime";
import { NARRATIVE_EFFECT_HANDLERS } from "../../features/narrative/effectRuntime";
import { STATE_EFFECT_HANDLERS } from "../../features/state/effectRuntime";

export const EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  ...NARRATIVE_EFFECT_HANDLERS,
  ...STATE_EFFECT_HANDLERS,
  ...INVENTORY_EFFECT_HANDLERS,
};
