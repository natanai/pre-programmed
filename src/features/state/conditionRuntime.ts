import { compareValues, type ConditionHandler, type ConditionValidator } from "../../engine/rules/conditionRuntime";

function nodeScopedValue(context: Parameters<ConditionHandler>[1], key: string) {
  const nodeId = context.scope?.kind === "node" ? context.scope.id : context.state.currentNodeId;
  return context.state.scopedValues?.node?.[nodeId]?.[key];
}

const flag: ConditionHandler = (condition, context) => {
  if (condition.type !== "flag") return false;
  const value = condition.scope === "node"
    ? (nodeScopedValue(context, condition.key) ?? false)
    : context.state.values[condition.key];
  return value === condition.value;
};

const variable: ConditionHandler = (condition, context) => {
  if (condition.type !== "variable") return false;
  return compareValues(context.state.values[condition.key], condition.operator, condition.value);
};

const validateVariable: ConditionValidator = (condition) =>
  condition.type === "variable" && !condition.key ? ["Variable conditions require a key."] : [];

export const STATE_CONDITION_HANDLERS: Readonly<Record<string, ConditionHandler>> = {
  flag,
  variable,
};

export const STATE_CONDITION_VALIDATORS: Readonly<Record<string, ConditionValidator>> = {
  variable: validateVariable,
};
