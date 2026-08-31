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
const ATTEMPTED_OPERATIONS = new Set(["inspect", "use", "move", "remove"]);

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
    const nested = operation.interaction ?? operation.item ?? operation.definition;
    if (object(nested)) {
      if (operation.type === "interaction.upsert" && nested.choiceVisibility !== undefined && !["immediate", "prompt", "typed"].includes(String(nested.choiceVisibility))) {
        return "Interaction choice visibility is invalid.";
      }
      if (operation.type === "interaction.upsert" && nested.matchMode !== undefined && !["command", "fallback"].includes(String(nested.matchMode))) {
        return "Interaction match mode is invalid.";
      }
      if (operation.type === "item.upsert" && nested.startingQuantity !== undefined && (!Number.isInteger(nested.startingQuantity) || (nested.startingQuantity as number) < 0)) {
        return "Item starting quantity must be a non-negative integer.";
      }
      if (operation.type === "variable.upsert" && nested.timeRate !== undefined && (typeof nested.timeRate !== "number" || !Number.isFinite(nested.timeRate))) {
        return "Variable time change must be a finite number.";
      }
      if (operation.type === "variable.upsert" && nested.timeUnit !== undefined && !["second", "minute", "hour"].includes(String(nested.timeUnit))) {
        return "Variable time unit is invalid.";
      }
      if (nested.interactable !== undefined && typeof nested.interactable !== "boolean") {
        return "Operation interactivity must be true or false.";
      }
      if (nested.operations !== undefined && (!Array.isArray(nested.operations) || nested.operations.some((candidate) => !ATTEMPTED_OPERATIONS.has(String(candidate))))) {
        return "An attempted operation is invalid.";
      }
      const outcomes = Array.isArray(nested.outcomes) ? nested.outcomes : [];
      const hooks = Array.isArray(nested.hooks) ? nested.hooks : [];
      for (const candidate of [...outcomes, ...hooks]) {
        if (!object(candidate) || !conditionValid(candidate.condition) || !effectsValid(candidate.effects)) {
          return "A condition or effect sequence is invalid.";
        }
        if (outcomes.includes(candidate) && candidate.authorStatus !== undefined && !["draft", "configured"].includes(String(candidate.authorStatus))) {
          return "Interaction outcome author status is invalid.";
        }
        if (outcomes.includes(candidate) && candidate.responseCharactersPerSecond !== undefined && (!Number.isInteger(candidate.responseCharactersPerSecond) || (candidate.responseCharactersPerSecond as number) < 1 || (candidate.responseCharactersPerSecond as number) > 120)) {
          return "Response text speed must be an integer from 1 to 120.";
        }
        if (hooks.includes(candidate) && (!ATTEMPTED_OPERATIONS.has(String(candidate.operation)) || typeof candidate.success !== "boolean")) {
          return "An operation hook is invalid.";
        }
      }
    }
  }
  return null;
}
