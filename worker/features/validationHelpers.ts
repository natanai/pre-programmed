import { CONDITION_TYPE_SET, EFFECT_TYPE_SET } from "../../src/engine/rules/catalog";

const OPERATION_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;

export function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function operationIdValid(value: unknown) {
  return typeof value === "string" && OPERATION_ID_PATTERN.test(value);
}

export function conditionValid(value: unknown, depth = 0): boolean {
  if (!object(value) || typeof value.type !== "string" || !CONDITION_TYPE_SET.has(value.type) || depth > 8) {
    return false;
  }
  if (value.type === "all" || value.type === "any") {
    return Array.isArray(value.conditions) && value.conditions.every((child) => conditionValid(child, depth + 1));
  }
  if (value.type === "not") return conditionValid(value.condition, depth + 1);
  return true;
}

export function effectsValid(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((effect) => object(effect) && typeof effect.type === "string" && EFFECT_TYPE_SET.has(effect.type))
  );
}

export function validateOperationCapabilities(nested: Record<string, unknown>) {
  if (nested.interactable !== undefined && typeof nested.interactable !== "boolean") {
    return "Operation interactivity must be true or false.";
  }
  if (nested.operations !== undefined && (
    !Array.isArray(nested.operations) ||
    nested.operations.length > 50 ||
    nested.operations.some((candidate) => !operationIdValid(candidate))
  )) {
    return "An attempted operation ID is invalid.";
  }
  return null;
}

export function validateHooks(nested: Record<string, unknown>) {
  const hooks = Array.isArray(nested.hooks) ? nested.hooks : [];
  for (const candidate of hooks) {
    if (!object(candidate) || !conditionValid(candidate.condition) || !effectsValid(candidate.effects)) {
      return "A condition or effect sequence is invalid.";
    }
    if (!operationIdValid(candidate.operation) || typeof candidate.success !== "boolean") {
      return "An operation hook is invalid.";
    }
  }
  return null;
}
