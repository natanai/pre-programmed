import type { AuthorFeatureManifest } from "../../../author/features/types";
import { APPLICATION_COMMAND_CAPABILITY_BY_OPERATION } from "../../../engine/application/catalog";
import type { CommandDefinition } from "../model";
import { COMMAND_PROJECT_SETTINGS_SECTION, commandProjectSettingsWorkspace } from "./CommandSettings";
import { COMMAND_STRUCTURED_WORKSPACES } from "./structuredWorkspaces";

function commandActionLabel(command: CommandDefinition) {
  if (command.action.type === "response") return "Respond with text";
  if (command.action.type === "target-operation") return `Target · ${command.action.operation}`;
  return APPLICATION_COMMAND_CAPABILITY_BY_OPERATION[command.action.operation]?.label ?? command.action.operation;
}

export const commandsAuthorFeature: AuthorFeatureManifest = {
  id: "commands",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "commands") return null;
    if (route.workspace === "settings") return "Player language";
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
  resources: [{
    kind: "player-command",
    label: "Player Command",
    pluralLabel: "Player Commands",
    list: (snapshot) => snapshot.settings.commands.commands.map((command) => ({
      id: command.id,
      value: command.id,
      label: command.label || commandActionLabel(command),
      detail: command.patterns.join(" · ") || commandActionLabel(command),
    })),
    createRoute: () => ({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new", resourceTask: "player-command" } }),
    editRoute: (resource) => ({ type: "feature", feature: "commands", workspace: "command", data: { commandId: resource.id, resourceTask: "player-command" } }),
  }],
  tools: (context) => [{
    groupId: "systems",
    groupLabel: "GAME SYSTEMS",
    groupOrder: 20,
    toolOrder: 40,
    tool: {
      id: "player-interactions",
      label: "PLAYER INTERACTIONS",
      description: "Project-wide commands and target behavior.",
      searchText: "project wide interaction interactions inspect use polish player behavior operation response command wording target",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "interactions" }),
    },
  }],
  projectSettings: COMMAND_PROJECT_SETTINGS_SECTION,
  workspaces: [commandProjectSettingsWorkspace, ...COMMAND_STRUCTURED_WORKSPACES],
  search: (context) => [
    {
      id: "commands:player-commands",
      groupLabel: "PLAYER LANGUAGE",
      label: "PLAYER COMMANDS",
      description: "Edit project-wide player inputs and actions.",
      searchText: "command commands valid input wording phrase grammar action operation target typed text inspect use polish save load response",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" }),
    },
    {
      id: "commands:target-aliases",
      groupLabel: "PLAYER LANGUAGE",
      label: "TARGET NAMES + ALIASES",
      description: "Alternate names player commands can recognize.",
      searchText: "reference references name names alias aliases item character location variable computed vocabulary current here",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "references" }),
    },
    ...context.snapshot.settings.commands.commands.map((command) => ({
      id: `commands:command:${command.id}`,
      groupLabel: "PLAYER COMMANDS",
      label: command.label || commandActionLabel(command),
      description: `${command.patterns.join(" · ") || "No player inputs"} · ${commandActionLabel(command)}`,
      searchText: `${command.label} ${commandActionLabel(command)} ${command.patterns.join(" ")} ${command.slots.map((slot) => `${slot.name} ${slot.sourceKinds.join(" ")}`).join(" ")}`,
      onSelect: () => context.pushTask({ type: "feature" as const, feature: "commands", workspace: "command", data: { commandId: command.id } }),
    })),
  ],
};
