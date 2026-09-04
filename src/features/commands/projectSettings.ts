import {
  CURRENT_COMMAND_STARTER_REVISION,
  DEFAULT_COMMAND_PROJECT_SETTINGS,
  LEGACY_COMMAND_STARTER_REVISION,
  starterCommandsAfter,
} from "./defaultCatalog";
import type { CommandProjectSettings } from "./model";

export type CommandsProjectSettingsSlice = {
  commands: CommandProjectSettings;
};

export const DEFAULT_COMMANDS_PROJECT_SETTINGS: CommandsProjectSettingsSlice = {
  commands: structuredClone(DEFAULT_COMMAND_PROJECT_SETTINGS),
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Normalize the Commands-owned settings slice while preserving authored empty
 * command configuration as intentional data rather than silently repairing it.
 *
 * Starter command releases are the one exception: a release newer than the
 * project's recorded starter revision is installed once, then the revision is
 * advanced. From that point the installed command is ordinary author data and
 * may be changed or deleted permanently.
 */
export function normalizeCommandsProjectSettings(root: Record<string, unknown>): CommandsProjectSettingsSlice {
  const hasCommands = Boolean(root.commands && typeof root.commands === "object");
  const commandsValue = hasCommands
    ? root.commands as Record<string, unknown>
    : {};

  const referenceSources = Array.isArray(commandsValue.referenceSources)
    ? commandsValue.referenceSources.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const item = candidate as Record<string, unknown>;
      if (typeof item.sourceKind !== "string") return [];
      const aliasesValue = item.aliases && typeof item.aliases === "object"
        ? item.aliases as Record<string, unknown>
        : {};
      return [{
        sourceKind: item.sourceKind,
        enabled: item.enabled !== false,
        includeDefaults: item.includeDefaults !== false,
        aliases: Object.fromEntries(Object.entries(aliasesValue).map(([id, aliases]) => [id, stringArray(aliases)])),
      }];
    })
    : [];

  const commands = Array.isArray(commandsValue.commands)
    ? commandsValue.commands.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const item = candidate as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.operation !== "string") return [];
      const slots = Array.isArray(item.slots)
        ? item.slots.flatMap((candidateSlot) => {
          if (!candidateSlot || typeof candidateSlot !== "object") return [];
          const slot = candidateSlot as Record<string, unknown>;
          return typeof slot.name === "string" && typeof slot.sourceKind === "string"
            ? [{ name: slot.name, sourceKind: slot.sourceKind }]
            : [];
        })
        : [];
      return [{
        id: item.id,
        label: typeof item.label === "string" ? item.label : item.operation,
        operation: item.operation,
        enabled: item.enabled !== false,
        patterns: stringArray(item.patterns),
        slots,
        targetSlot: typeof item.targetSlot === "string" ? item.targetSlot : "",
      }];
    })
    : [];

  if (!hasCommands) {
    return structuredClone(DEFAULT_COMMANDS_PROJECT_SETTINGS);
  }

  const storedRevision = typeof commandsValue.starterRevision === "number"
    && Number.isInteger(commandsValue.starterRevision)
    && commandsValue.starterRevision >= 0
    ? commandsValue.starterRevision
    : LEGACY_COMMAND_STARTER_REVISION;
  const existingIds = new Set(commands.map((command) => command.id));
  const existingOperations = new Set(commands.map((command) => command.operation));
  const newStarters = starterCommandsAfter(storedRevision)
    .filter((command) => !existingIds.has(command.id) && !existingOperations.has(command.operation));

  return {
    commands: {
      starterRevision: Math.max(storedRevision, CURRENT_COMMAND_STARTER_REVISION),
      referenceSources,
      commands: [...commands, ...newStarters],
    },
  };
}
