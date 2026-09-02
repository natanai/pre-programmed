import type { AuthorFeatureManifest } from "../../../author/features/types";
import {
  COMMAND_PROJECT_SETTINGS_SECTION,
  renderCommandSettingsWorkspace,
} from "./CommandSettings";

export const commandsAuthorFeature: AuthorFeatureManifest = {
  id: "commands",
  projectSettings: COMMAND_PROJECT_SETTINGS_SECTION,
  search: (context) => [
    {
      id: "commands:player-commands",
      groupLabel: "PLAYER LANGUAGE",
      label: "PLAYER COMMANDS + LABELS",
      description: "Name commands and define valid player input patterns, operations, argument slots, and targets.",
      searchText: "command commands label labels valid input wording phrase grammar operation argument slot target typed text",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" }),
    },
    {
      id: "commands:target-aliases",
      groupLabel: "PLAYER LANGUAGE",
      label: "TARGET NAMES + ALIASES",
      description: "Choose which authored resources player commands can name and add alternate words.",
      searchText: "reference references name names alias aliases item character location variable computed vocabulary",
      onSelect: () => context.pushTask({ type: "feature", feature: "commands", workspace: "references" }),
    },
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
