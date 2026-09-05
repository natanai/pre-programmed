import {
  CURRENT_COMMAND_STARTER_REVISION,
  DEFAULT_COMMAND_PROJECT_SETTINGS,
  LEGACY_COMMAND_STARTER_REVISION,
  starterCommandsAfter,
} from "./defaultCatalog";
import type {
  CommandAction,
  CommandDefinition,
  CommandProjectSettings,
  CommandResponseAction,
} from "./model";

export type CommandsProjectSettingsSlice = {
  commands: CommandProjectSettings;
};

export const DEFAULT_COMMANDS_PROJECT_SETTINGS: CommandsProjectSettingsSlice = {
  commands: structuredClone(DEFAULT_COMMAND_PROJECT_SETTINGS),
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function responseAction(value: Record<string, unknown>): CommandResponseAction {
  const performance = value.responsePerformance && typeof value.responsePerformance === "object"
    ? value.responsePerformance as Record<string, unknown>
    : {};
  return {
    type: "response",
    responseText: typeof value.responseText === "string" ? value.responseText : "",
    responsePerformance: {
      charactersPerSecond: typeof performance.charactersPerSecond === "number" && Number.isFinite(performance.charactersPerSecond)
        ? performance.charactersPerSecond
        : 18,
      cues: Array.isArray(performance.cues)
        ? performance.cues as CommandResponseAction["responsePerformance"]["cues"]
        : [],
    },
    speakerId: typeof value.speakerId === "string" ? value.speakerId : null,
    effects: Array.isArray(value.effects) ? value.effects as CommandResponseAction["effects"] : [],
  };
}

function normalizeAction(item: Record<string, unknown>): CommandAction | null {
  if (item.action && typeof item.action === "object") {
    const action = item.action as Record<string, unknown>;
    if (action.type === "response") return responseAction(action);
    if (action.type === "application" && typeof action.operation === "string") {
      return { type: "application", operation: action.operation };
    }
    if (action.type === "target-operation" && typeof action.operation === "string") {
      return {
        type: "target-operation",
        operation: action.operation,
        targetSlot: typeof action.targetSlot === "string" ? action.targetSlot : "",
      };
    }
  }

  // One-way compatibility for the original command model. Once the project is
  // saved again only the action union is written.
  if (typeof item.operation !== "string") return null;
  const targetSlot = typeof item.targetSlot === "string" ? item.targetSlot : "";
  return targetSlot
    ? { type: "target-operation", operation: item.operation, targetSlot }
    : { type: "application", operation: item.operation };
}

function actionOperation(action: CommandAction) {
  return action.type === "response" ? "" : action.operation;
}

/**
 * Normalize the Commands-owned settings slice while preserving authored empty
 * command configuration as intentional data rather than silently repairing it.
 *
 * Starter command releases are the one exception: a release newer than the
 * project's recorded starter revision is installed once, then the revision is
 * advanced. Legacy command payloads are converted one-way into the current
 * action/slot contracts at this same read boundary.
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

  const commands: CommandDefinition[] = Array.isArray(commandsValue.commands)
    ? commandsValue.commands.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const item = candidate as Record<string, unknown>;
      if (typeof item.id !== "string") return [];
      const action = normalizeAction(item);
      if (!action) return [];
      const slots = Array.isArray(item.slots)
        ? item.slots.flatMap((candidateSlot) => {
          if (!candidateSlot || typeof candidateSlot !== "object") return [];
          const slot = candidateSlot as Record<string, unknown>;
          if (typeof slot.name !== "string") return [];
          const sourceKinds = stringArray(slot.sourceKinds).filter((kind) => kind !== "text");
          const legacyKind = typeof slot.sourceKind === "string" && slot.sourceKind !== "text"
            ? slot.sourceKind
            : "";
          return [{ name: slot.name, sourceKinds: sourceKinds.length ? sourceKinds : legacyKind ? [legacyKind] : [] }];
        })
        : [];
      return [{
        id: item.id,
        label: typeof item.label === "string"
          ? item.label
          : action.type === "response" ? "Response" : action.operation,
        enabled: item.enabled !== false,
        patterns: stringArray(item.patterns),
        slots,
        action,
      } satisfies CommandDefinition];
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
  const existingOperations = new Set(commands.map((command) => actionOperation(command.action)).filter(Boolean));
  const newStarters = starterCommandsAfter(storedRevision)
    .filter((command) => !existingIds.has(command.id)
      && (!actionOperation(command.action) || !existingOperations.has(actionOperation(command.action))));

  return {
    commands: {
      starterRevision: Math.max(storedRevision, CURRENT_COMMAND_STARTER_REVISION),
      referenceSources,
      commands: [...commands, ...newStarters],
    },
  };
}
