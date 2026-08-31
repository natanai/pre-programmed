import { compareValues, type ConditionHandler } from "../../engine/rules/conditionRuntime";

const flag: ConditionHandler = (condition, context) => {
  if (condition.type !== "flag") return false;
  return context.state.values[condition.key] === condition.value;
};

const variable: ConditionHandler = (condition, context) => {
  if (condition.type !== "variable") return false;
  return compareValues(context.state.values[condition.key], condition.operator, condition.value);
};

export const STATE_CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = {
  flag,
  variable,
};
