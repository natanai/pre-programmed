import { CONDITION_HANDLERS } from "../engine/rules/conditionCatalog";
import { compareValues, type ConditionContext } from "../engine/rules/conditionRuntime";
import type { Condition } from "./model";

export { compareValues } from "../engine/rules/conditionRuntime";
export type { ConditionContext } from "../engine/rules/conditionRuntime";

export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  const { state } = context;
  switch (condition.type) {
    case "always":
      return true;
    case "all":
      return condition.conditions.every((child) => evaluateCondition(child, context));
    case "any":
      return condition.conditions.some((child) => evaluateCondition(child, context));
    case "not":
      return !evaluateCondition(condition.condition, context);
    case "attempt": {
      const eventKey = condition.eventKey || context.eventKey || "";
      return compareValues(state.attempts[eventKey] ?? 0, condition.operator, condition.value);
    }
    case "state":
      return compareValues(state[condition.field], condition.operator, condition.value);
    default: {
      const handler = CONDITION_HANDLERS[condition.type];
      return handler ? handler(condition, context) : false;
    }
  }
}

export function validateCondition(condition: Condition, depth = 0): string[] {
  if (depth > 8) return ["Condition nesting cannot exceed eight levels."];
  switch (condition.type) {
    case "all":
    case "any":
      return condition.conditions.flatMap((child) => validateCondition(child, depth + 1));
    case "not":
      return validateCondition(condition.condition, depth + 1);
    case "variable":
      return condition.key ? [] : ["Variable conditions require a key."];
    case "attempt":
      return Number.isFinite(condition.value) && condition.value >= 0
        ? []
        : ["Attempt conditions require a non-negative number."];
    case "has_item":
    case "lacks_item":
      return condition.itemId ? [] : ["Item conditions require an item."];
    default:
      return [];
  }
}
