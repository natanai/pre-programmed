import type { ConditionHandler } from "./conditionRuntime";
import { INVENTORY_CONDITION_HANDLERS } from "../../features/inventory/conditionRuntime";
import { NARRATIVE_CONDITION_HANDLERS } from "../../features/narrative/conditionRuntime";
import { STATE_CONDITION_HANDLERS } from "../../features/state/conditionRuntime";

export const CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = {
  ...NARRATIVE_CONDITION_HANDLERS,
  ...STATE_CONDITION_HANDLERS,
  ...INVENTORY_CONDITION_HANDLERS,
};
