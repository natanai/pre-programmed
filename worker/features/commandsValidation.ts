import { effectsValid, object, operationIdValid } from "./validationHelpers";

const SLOT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

function stringArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value) && value.length <= maxItems && value.every(
    (item) => typeof item === "string" && item.length <= maxLength,
  );
}

function performanceValid(value: unknown) {
  return object(value)
    && Number.isInteger(value.charactersPerSecond)
    && (value.charactersPerSecond as number) >= 1
    && (value.charactersPerSecond as number) <= 120
    && Array.isArray(value.cues);
}

function actionValid(action: unknown, slots: unknown[]) {
  if (!object(action) || typeof action.type !== "string") return false;

  if (action.type === "application") return operationIdValid(action.operation);

  if (action.type === "target-operation") {
    if (!operationIdValid(action.operation)) return false;
    if (typeof action.targetSlot !== "string" || !SLOT_NAME_PATTERN.test(action.targetSlot)) return false;
    return slots.some((slot) => object(slot)
      && slot.name === action.targetSlot
      && Array.isArray(slot.sourceKinds)
      && slot.sourceKinds.length > 0);
  }

  if (action.type === "response") {
    if (typeof action.responseText !== "string" || action.responseText.length > 12000) return false;
    if (!performanceValid(action.responsePerformance)) return false;
    if (action.speakerId !== null && action.speakerId !== undefined
      && (typeof action.speakerId !== "string" || action.speakerId.length > 128)) return false;
    return effectsValid(action.effects);
  }

  return false;
}

/** Validate the Commands-owned slice of project settings. */
export function commandsProjectSettingsValid(value: unknown) {
  if (!object(value) || !object(value.commands)) return false;

  const referenceSources = value.commands.referenceSources;
  const commands = value.commands.commands;
  const starterRevision = value.commands.starterRevision;
  if (starterRevision !== undefined && (!Number.isInteger(starterRevision) || (starterRevision as number) < 0)) return false;
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
    if (typeof command.label !== "string" || command.label.length > 96 || typeof command.enabled !== "boolean") return false;
    if (!stringArray(command.patterns, 32, 180) || !Array.isArray(command.slots) || command.slots.length > 12) return false;
    for (const slot of command.slots) {
      if (!object(slot) || typeof slot.name !== "string" || !SLOT_NAME_PATTERN.test(slot.name)) return false;
      if (!stringArray(slot.sourceKinds, 16, 64) || !slot.sourceKinds.every(operationIdValid)) return false;
    }
    if (!actionValid(command.action, command.slots)) return false;
  }

  return true;
}
