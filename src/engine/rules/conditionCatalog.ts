import type { ConditionHandler, ConditionValidator } from "./conditionRuntime";
import { NARRATIVE_CONDITION_HANDLERS } from "../../features/narrative/conditionRuntime";
import { STATE_CONDITION_HANDLERS, STATE_CONDITION_VALIDATORS } from "../../features/state/conditionRuntime";

export const CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = {
  ...NARRATIVE_CONDITION_HANDLERS,
  ...STATE_CONDITION_HANDLERS,
};

export const CONDITION_VALIDATORS: Readonly<Record<string, ConditionValidator>> = {
  ...STATE_CONDITION_VALIDATORS,
};
