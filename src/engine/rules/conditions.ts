import { CONDITION_HANDLERS, CONDITION_VALIDATORS } from "./conditionCatalog";
import { compareValues, type ConditionContext } from "./conditionRuntime";
import type { Condition } from "./model";

export { compareValues } from "./conditionRuntime";
export type { ConditionContext } from "./conditionRuntime";

/**
 * Shared condition evaluator.
 *
 * Engine Rules owns recursive composition and generic runtime conditions.
 * Feature-specific condition types are delegated through the condition catalog.
 */
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

/**
 * Validate recursive/generic condition structure, then delegate leaf validation
 * to the feature that owns that condition type.
 */
export function validateCondition(condition: Condition, depth = 0): string[] {
  if (depth > 8) return ["Condition nesting cannot exceed eight levels."];
  switch (condition.type) {
    case "all":
    case "any":
      return condition.conditions.flatMap((child) => validateCondition(child, depth + 1));
    case "not":
      return validateCondition(condition.condition, depth + 1);
    case "attempt":
      return Number.isFinite(condition.value) && condition.value >= 0
        ? []
        : ["Attempt conditions require a non-negative number."];
    default:
      return CONDITION_VALIDATORS[condition.type]?.(condition) ?? [];
  }
}
