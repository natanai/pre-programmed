import { DEFAULT_COMMAND_PROJECT_SETTINGS } from "./defaultCatalog";
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

  return {
    commands: hasCommands
      ? { referenceSources, commands }
      : structuredClone(DEFAULT_COMMANDS_PROJECT_SETTINGS.commands),
  };
}
