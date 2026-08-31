import { CONDITION_TYPE_SET, EFFECT_TYPE_SET } from "../src/engine/rules/catalog";

const OPERATION_TYPES = new Set([
  "project.settings",
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
const OPERATION_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const SLOT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function operationIdValid(value: unknown) {
  return typeof value === "string" && OPERATION_ID_PATTERN.test(value);
}

function stringArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value) && value.length <= maxItems && value.every(
    (item) => typeof item === "string" && item.length <= maxLength,
  );
}

function projectSettingsValid(value: unknown) {
  if (!object(value)) return false;
  if (typeof value.terminalPrompt !== "string" || value.terminalPrompt.length < 1 || value.terminalPrompt.length > 32) return false;
  if (!object(value.commands)) return false;

  const referenceSources = value.commands.referenceSources;
  const commands = value.commands.commands;
  if (!Array.isArray(referenceSources) || referenceSources.length > 64) return false;
  if (!Array.isArray(commands) || commands.length > 200) return false;

  for (const source of referenceSources) {
    if (!object(source) || !operationIdValid(source.sourceKind)) return false;
    if (typeof source.enabled !== "boolean" || typeof source.includeDefaults !== "boolean") return false;
    if (!object(source.aliases) || Object.keys(source.aliases).length > 500) return false;
    for (const aliases of Object.values(source.aliases)) {
      if (!stringArray(aliases, 32, 96)) return false;
    }
  }

  for (const command of commands) {
    if (!object(command) || typeof command.id !== "string" || command.id.length > 96) return false;
    if (!operationIdValid(command.operation)) return false;
    if (typeof command.label !== "string" || command.label.length > 96 || typeof command.enabled !== "boolean") return false;
    if (!stringArray(command.patterns, 32, 180) || !Array.isArray(command.slots) || command.slots.length > 12) return false;
    if (typeof command.targetSlot !== "string" || command.targetSlot.length > 32) return false;
    for (const slot of command.slots) {
      if (!object(slot) || typeof slot.name !== "string" || !SLOT_NAME_PATTERN.test(slot.name)) return false;
      if (typeof slot.sourceKind !== "string" || (slot.sourceKind !== "text" && !operationIdValid(slot.sourceKind))) return false;
    }
  }
  return true;
}

function conditionValid(value: unknown, depth = 0): boolean {
  if (!object(value) || typeof value.type !== "string" || !CONDITION_TYPE_SET.has(value.type) || depth > 8) {
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
    value.every((effect) => object(effect) && typeof effect.type === "string" && EFFECT_TYPE_SET.has(effect.type))
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
    if (operation.type === "project.settings") {
      if (!projectSettingsValid(operation.settings)) return "Project settings are invalid.";
      continue;
    }
    const nested = operation.interaction ?? operation.item ?? operation.definition ?? operation.entity;
    if (object(nested)) {
      if (operation.type === "interaction.upsert" && nested.choiceVisibility !== undefined && !["immediate", "prompt", "typed"].includes(String(nested.choiceVisibility))) {
        return "Interaction choice visibility is invalid.";
      }
      if (operation.type === "interaction.upsert" && nested.matchMode !== undefined && !["command", "fallback"].includes(String(nested.matchMode))) {
        return "Interaction match mode is invalid.";
      }
      if (operation.type === "entity.upsert" && nested.type !== undefined && !["character", "location"].includes(String(nested.type))) {
        return "World entity type is invalid.";
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
      if (nested.operations !== undefined && (
        !Array.isArray(nested.operations) ||
        nested.operations.length > 50 ||
        nested.operations.some((candidate) => !operationIdValid(candidate))
      )) {
        return "An attempted operation ID is invalid.";
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
        if (hooks.includes(candidate) && (!operationIdValid(candidate.operation) || typeof candidate.success !== "boolean")) {
          return "An operation hook is invalid.";
        }
      }
    }
  }
  return null;
}
