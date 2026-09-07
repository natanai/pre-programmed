import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../../../author/features/types";
import { SEMANTIC_REFERENCE_PROVIDERS } from "../../../engine/references/catalog";
import "./commandSettings.css";

function targetProviders() {
  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);
}

function CommandsOverview({ context }: { context: AuthorWorkspaceContext }) {
  const enabledSources = context.snapshot.settings.commands.referenceSources.filter((source) => source.enabled).length;
  const enabledCommands = context.snapshot.settings.commands.commands.filter((command) => command.enabled).length;
  return <div className="command-settings-overview">
    <button type="button" className="command-settings-create" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" } })}>[+ NEW PLAYER COMMAND]</button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
      <span><strong>PLAYER COMMANDS</strong><small>Project-wide player inputs and what they do.</small></span><span>{enabledCommands} ›</span>
    </button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "references" })}>
      <span><strong>TARGET NAMES + ALIASES</strong><small>Player vocabulary supplied by semantic target owners.</small></span><span>{enabledSources}/{targetProviders().length} ›</span>
    </button>
  </div>;
}

export const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [{
  id: "commands",
  label: "PLAYER LANGUAGE",
  description: "Player commands and target names.",
  order: 20,
  render: (context) => <CommandsOverview context={context} />,
}];
