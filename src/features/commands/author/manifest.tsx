import type { AuthorFeatureManifest } from "../../../author/features/types";
import {
  COMMAND_PROJECT_SETTINGS_SECTION,
  renderCommandSettingsWorkspace,
} from "./CommandSettings";

export const commandsAuthorFeature: AuthorFeatureManifest = {
  id: "commands",
  tools: (context) => [{
    groupId: "scene",
    groupLabel: "CURRENT SCENE",
    groupOrder: 10,
    toolOrder: 40,
    tool: {
      id: "player-interactions",
      label: "PLAYER INTERACTIONS",
      description: "Scene inputs, reusable commands, and target-specific inspect/use/custom behavior.",
      searchText: "interaction interactions inspect use polish player behavior operation response command wording target",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "interactions" }),
    },
  }],
  projectSettings: COMMAND_PROJECT_SETTINGS_SECTION,
  search: (context) => [
    {
      id: "commands:player-commands",
      groupLabel: "PLAYER LANGUAGE",
      label: "PLAYER COMMANDS + LABELS",
      description: "Name commands and define valid player input patterns, operations, argument slots, and targets.",
      searchText: "command commands label labels valid input wording phrase grammar operation argument slot target typed text inspect use polish player behavior response",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "interactions" }),
    },
    {
      id: "commands:target-aliases",
      groupLabel: "PLAYER LANGUAGE",
      label: "TARGET NAMES + ALIASES",
      description: "Choose which authored resources player commands can name and add alternate words.",
      searchText: "reference references name names alias aliases item character location variable computed vocabulary",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "references" }),
    },
    ...context.snapshot.settings.commands.commands.map((command) => ({
      id: `commands:command:${command.id}`,
      groupLabel: "PLAYER COMMANDS",
      label: command.label || command.operation,
      description: `${command.patterns.join(" · ") || "No input patterns"} · ${command.operation}`,
      searchText: `${command.label} ${command.operation} ${command.patterns.join(" ")} ${command.slots.map((slot) => `${slot.name} ${slot.sourceKind}`).join(" ")} ${command.targetSlot}`,
      onSelect: () => context.pushTask({ type: "feature" as const, feature: "commands", workspace: "command", data: { commandId: command.id } }),
    })),
    {
      id: "commands:application-actions",
      groupLabel: "PLAYER LANGUAGE",
      label: "APPLICATION ACTIONS",
      description: "Connect player wording to feature-provided actions such as opening Inventory.",
      searchText: "capability capabilities application action actions engine module terminal command operation",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "capabilities" }),
    },
  ],
  renderWorkspace: renderCommandSettingsWorkspace,
};
