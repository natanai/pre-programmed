import { compareValues, type ConditionHandler, type ConditionValidator } from "../../engine/rules/conditionRuntime";

const flag: ConditionHandler = (condition, context) => {
  if (condition.type !== "flag") return false;
  return context.state.values[condition.key] === condition.value;
};

const variable: ConditionHandler = (condition, context) => {
  if (condition.type !== "variable") return false;
  return compareValues(context.state.values[condition.key], condition.operator, condition.value);
};

const validateVariable: ConditionValidator = (condition) =>
  condition.type === "variable" && !condition.key ? ["Value comparisons require a value."] : [];

export const VALUES_CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = { flag, variable };
export const VALUES_CONDITION_VALIDATORS: Readonly<Record<string, ConditionValidator>> = { variable: validateVariable };
