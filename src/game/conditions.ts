import type { ComparisonOperator, Condition, PlayState, ProjectSnapshot, Value } from "./model";

export type ConditionContext = {
  snapshot: ProjectSnapshot;
  state: PlayState;
  eventKey?: string;
};

export function compareValues(left: Value | undefined, operator: ComparisonOperator, right: Value) {
  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
  }
}

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
    case "has_item": {
      const quantity = state.inventory
        .filter((entry) => entry.itemId === condition.itemId)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      return quantity >= (condition.minimum ?? 1);
    }
    case "lacks_item":
      return !state.inventory.some((entry) => entry.itemId === condition.itemId && entry.quantity > 0);
    case "flag":
      return state.values[condition.key] === condition.value;
    case "variable":
      return compareValues(state.values[condition.key], condition.operator, condition.value);
    case "attempt": {
      const eventKey = condition.eventKey || context.eventKey || "";
      return compareValues(state.attempts[eventKey] ?? 0, condition.operator, condition.value);
    }
    case "visited":
      return state.visitedNodeIds.includes(condition.nodeId) === condition.value;
    case "state":
      return compareValues(state[condition.field], condition.operator, condition.value);
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
