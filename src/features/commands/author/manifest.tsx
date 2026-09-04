import type { AuthorFeatureManifest } from "../../../author/features/types";
import { APPLICATION_COMMAND_CAPABILITY_BY_OPERATION } from "../../../engine/application/catalog";
import {
  COMMAND_PROJECT_SETTINGS_SECTION,
  renderCommandSettingsWorkspace,
} from "./CommandSettings";

export const commandsAuthorFeature: AuthorFeatureManifest = {
  id: "commands",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "commands") return null;
    if (route.workspace === "interactions") return "Player interactions";
    if (route.workspace === "grammar" || route.workspace === "capabilities") return "Player commands";
    if (route.workspace === "references") return "Target names + aliases";
    if (route.workspace === "reference-source") return route.data?.sourceKind || "Target names";
    if (route.workspace === "target-behaviors") return `${route.data?.commandLabel || route.data?.operation || "Command"} · target behavior`;
    if (route.workspace === "command") {
      const command = snapshot.settings.commands.commands.find((candidate) => candidate.id === route.data?.commandId);
      return command?.label || route.data?.operation || "New player command";
    }
    return null;
  },
  tools: (context) => [{
    groupId: "scene",
    groupLabel: "CURRENT SCENE",
    groupOrder: 10,
    toolOrder: 40,
    tool: {
      id: "player-interactions",
      label: "PLAYER INTERACTIONS",
      description: "Scene inputs, reusable commands, and target behavior.",
      searchText: "interaction interactions inspect use polish player behavior operation response command wording target",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "interactions" }),
    },
  }],
  projectSettings: COMMAND_PROJECT_SETTINGS_SECTION,
  search: (context) => [
    {
      id: "commands:player-commands",
      groupLabel: "PLAYER LANGUAGE",
      label: "PLAYER COMMANDS",
      description: "Edit project-wide player inputs and actions.",
      searchText: "command commands valid input wording phrase grammar action operation target typed text inspect use polish save load",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" }),
    },
    {
      id: "commands:target-aliases",
      groupLabel: "PLAYER LANGUAGE",
      label: "TARGET NAMES + ALIASES",
      description: "Alternate names player commands can recognize.",
      searchText: "reference references name names alias aliases item character location variable computed vocabulary",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "references" }),
    },
    ...context.snapshot.settings.commands.commands.map((command) => {
      const action = APPLICATION_COMMAND_CAPABILITY_BY_OPERATION[command.operation];
      return {
        id: `commands:command:${command.id}`,
        groupLabel: "PLAYER COMMANDS",
        label: command.label || command.operation,
        description: `${command.patterns.join(" · ") || "No player inputs"} · ${action?.label ?? command.operation}`,
        searchText: `${command.label} ${command.operation} ${action?.label ?? ""} ${command.patterns.join(" ")} ${command.slots.map((slot) => `${slot.name} ${slot.sourceKind}`).join(" ")} ${command.targetSlot}`,
        onSelect: () => context.pushTask({ type: "feature" as const, feature: "commands", workspace: "command", data: { commandId: command.id } }),
      };
    }),
  ],
  renderWorkspace: renderCommandSettingsWorkspace,
};
