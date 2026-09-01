import { object, operationIdValid } from "./validationHelpers";

const SLOT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

function stringArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value) && value.length <= maxItems && value.every(
    (item) => typeof item === "string" && item.length <= maxLength,
  );
}

/** Validate the Commands-owned slice of project settings. */
export function commandsProjectSettingsValid(value: unknown) {
  if (!object(value) || !object(value.commands)) return false;

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
