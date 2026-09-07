import type { AuthorProjectSettingsSection } from "../../../author/features/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { SEMANTIC_REFERENCE_PROVIDERS } from "../../../engine/references/catalog";

function targetProviders() {
  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);
}

export const commandProjectSettingsWorkspace = defineAuthorWorkspace<null>({
  id: "commands-settings",
  matches: (route) => route.type === "feature" && route.feature === "commands" && route.workspace === "settings",
  createDraft: () => null,
  buildSpec: ({ context }) => {
    const enabledSources = context.snapshot.settings.commands.referenceSources.filter((source) => source.enabled).length;
    const enabledCommands = context.snapshot.settings.commands.commands.filter((command) => command.enabled).length;
    return {
      id: "commands-settings",
      title: "PLAYER LANGUAGE",
      context: "Project-wide player inputs and target vocabulary",
      blocks: [{
        type: "section",
        id: "commands-settings-links",
        label: "PLAYER LANGUAGE",
        importance: "primary",
        children: [{
          type: "action-row",
          id: "commands-settings-actions",
          actions: [
            {
              id: "commands-settings-new-command",
              label: "+ NEW PLAYER COMMAND",
              onAction: () => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" } }),
            },
            {
              id: "commands-settings-commands",
              label: `PLAYER COMMANDS · ${enabledCommands}`,
              onAction: () => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" }),
            },
            {
              id: "commands-settings-references",
              label: `TARGET NAMES + ALIASES · ${enabledSources}/${targetProviders().length}`,
              onAction: () => context.pushTask({ type: "feature", feature: "commands", workspace: "references" }),
            },
          ],
        }],
      }],
    };
  },
});

export const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [{
  id: "commands",
  label: "PLAYER LANGUAGE",
  description: "Player commands and target names.",
  order: 20,
  route: { type: "feature", feature: "commands", workspace: "settings" },
}];
