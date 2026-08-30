const CONDITION_TYPES = new Set([
  "always",
  "all",
  "any",
  "not",
  "has_item",
  "lacks_item",
  "flag",
  "variable",
  "attempt",
  "visited",
  "state",
]);
const EFFECT_TYPES = new Set([
  "set_flag",
  "clear_flag",
  "set_value",
  "increment",
  "decrement",
  "give_item",
  "remove_item",
  "set_item_state",
  "set_interaction_visibility",
  "notification",
  "synth",
  "audio",
  "art",
  "transition",
]);
const OPERATION_TYPES = new Set([
  "node.upsert",
  "interaction.upsert",
  "interaction.delete",
  "entity.upsert",
  "variable.upsert",
  "computed.upsert",
  "item.upsert",
  "synth.upsert",
  "bookmark.upsert",
  "bookmark.delete",
]);

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function conditionValid(value: unknown, depth = 0): boolean {
  if (!object(value) || typeof value.type !== "string" || !CONDITION_TYPES.has(value.type) || depth > 8) {
    return false;
  }
  if (value.type === "all" || value.type === "any") {
    return Array.isArray(value.conditions) && value.conditions.every((child) => conditionValid(child, depth + 1));
  }
  if (value.type === "not") return conditionValid(value.condition, depth + 1);
  return true;
}

function effectsValid(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((effect) => object(effect) && typeof effect.type === "string" && EFFECT_TYPES.has(effect.type))
  );
}

export function validateMutationBody(value: unknown) {
  if (!object(value)) return "Invalid body.";
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) {
    return "expectedRevision must be a non-negative integer.";
  }
  if (typeof value.description !== "string" || value.description.length > 240) {
    return "description must be no longer than 240 characters.";
  }
  if (!Array.isArray(value.operations) || value.operations.length < 1 || value.operations.length > 50) {
    return "operations must contain between one and fifty operations.";
  }
  for (const operation of value.operations) {
    if (!object(operation) || typeof operation.type !== "string" || !OPERATION_TYPES.has(operation.type)) {
      return "Unknown mutation operation.";
    }
    const nested = operation.interaction ?? operation.item;
    if (object(nested)) {
      const outcomes = Array.isArray(nested.outcomes) ? nested.outcomes : [];
      const hooks = Array.isArray(nested.hooks) ? nested.hooks : [];
      for (const candidate of [...outcomes, ...hooks]) {
        if (!object(candidate) || !conditionValid(candidate.condition) || !effectsValid(candidate.effects)) {
          return "A condition or effect sequence is invalid.";
        }
      }
    }
  }
  return null;
}
