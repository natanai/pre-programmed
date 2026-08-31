import {
  EMPTY_COMMAND_PROJECT_SETTINGS,
  type CommandProjectSettings,
} from "../../features/commands/model";

export type ProjectSettings = {
  /** Player-facing terminal prompt for this game/project. */
  terminalPrompt: string;
  /** Commands feature configuration contributed to the project settings surface. */
  commands: CommandProjectSettings;
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  terminalPrompt: "U:\\>",
  commands: structuredClone(EMPTY_COMMAND_PROJECT_SETTINGS),
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Read old/partial persisted settings without requiring a data migration for
 * every future optional setting. Unknown feature configuration is ignored by
 * this version rather than becoming runtime behavior accidentally.
 */
export function normalizeProjectSettings(value: unknown): ProjectSettings {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const commandsValue = root.commands && typeof root.commands === "object"
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
      if (typeof item.id !== "string" || typeof item.key !== "string" || typeof item.operation !== "string") return [];
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
        key: item.key,
        label: typeof item.label === "string" ? item.label : item.key,
        operation: item.operation,
        enabled: item.enabled !== false,
        patterns: stringArray(item.patterns),
        slots,
        targetSlot: typeof item.targetSlot === "string" ? item.targetSlot : "",
      }];
    })
    : [];

  return {
    terminalPrompt: typeof root.terminalPrompt === "string" && root.terminalPrompt.trim()
      ? root.terminalPrompt.slice(0, 32)
      : DEFAULT_PROJECT_SETTINGS.terminalPrompt,
    commands: { referenceSources, commands },
  };
}
