import type { EffectHandler } from "./effectRuntime";
import { CORE_EFFECT_HANDLERS } from "./coreEffectRuntime";
import { INVENTORY_EFFECT_HANDLERS } from "../../features/inventory/effectRuntime";
import { MEDIA_EFFECT_HANDLERS } from "../../features/media/effectRuntime";
import { NARRATIVE_EFFECT_HANDLERS } from "../../features/narrative/effectRuntime";
import { STATE_EFFECT_HANDLERS } from "../../features/state/effectRuntime";

export const EFFECT_HANDLERS: Readonly<Record<string, EffectHandler>> = {
  ...CORE_EFFECT_HANDLERS,
  ...NARRATIVE_EFFECT_HANDLERS,
  ...STATE_EFFECT_HANDLERS,
  ...INVENTORY_EFFECT_HANDLERS,
  ...MEDIA_EFFECT_HANDLERS,
};
