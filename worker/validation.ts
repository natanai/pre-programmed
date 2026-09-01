import { WORKER_MUTATION_VALIDATOR_BY_TYPE } from "./features/validationCatalog";
import { object, operationIdValid } from "./features/validationHelpers";

const CORE_OPERATION_TYPES = new Set([
  "project.settings",
  "bookmark.upsert",
  "bookmark.delete",
]);
const SLOT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

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
    if (!object(operation) || typeof operation.type !== "string") return "Unknown mutation operation.";

    const featureValidator = WORKER_MUTATION_VALIDATOR_BY_TYPE[operation.type];
    if (!CORE_OPERATION_TYPES.has(operation.type) && !featureValidator) {
      return "Unknown mutation operation.";
    }

    if (operation.type === "project.settings") {
      if (!projectSettingsValid(operation.settings)) return "Project settings are invalid.";
      continue;
    }

    const featureError = featureValidator?.validate(operation);
    if (featureError) return featureError;
  }
  return null;
}
