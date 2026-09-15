import type { AuthorProjectSettingsSection } from "../features/types";
import { defineAuthorWorkspace } from "../ui/workspaceDefinition";

type ProjectTerminalSettingsDraft = {
  terminalPrompt: string;
  suggestionMenuHelpText: string;
};

const NULL_SUGGESTION_HELP_TEXT = "null";
const MAX_SUGGESTION_HELP_TEXT_LENGTH = 1000;

export const projectTerminalSettingsWorkspace = defineAuthorWorkspace<ProjectTerminalSettingsDraft>({
  id: "project-terminal-settings",
  matches: (route) => route.type === "feature" && route.feature === "project" && route.workspace === "terminal-settings",
  createDraft: (_route, context) => ({
    terminalPrompt: context.snapshot.settings.terminalPrompt,
    suggestionMenuHelpText: context.snapshot.settings.suggestionMenuHelpText ?? NULL_SUGGESTION_HELP_TEXT,
  }),
  canSave: ({ draft }) => Boolean(draft.terminalPrompt.trim()),
  save: async ({ context, draft }) => {
    const terminalPrompt = draft.terminalPrompt.trim().slice(0, 32);
    if (!terminalPrompt) return { accepted: false };

    const authoredHelpText = draft.suggestionMenuHelpText.trim();
    const suggestionMenuHelpText = !authoredHelpText || authoredHelpText.toLowerCase() === NULL_SUGGESTION_HELP_TEXT
      ? null
      : authoredHelpText.slice(0, MAX_SUGGESTION_HELP_TEXT_LENGTH);
    const settings = { ...context.snapshot.settings, terminalPrompt, suggestionMenuHelpText };
    const result = await context.persist(
      [{ type: "project.settings", settings }],
      "Changed project terminal settings",
    );
    return result.status === "saved" || result.status === "queued"
      ? {
        accepted: true,
        draft: {
          terminalPrompt,
          suggestionMenuHelpText: suggestionMenuHelpText ?? NULL_SUGGESTION_HELP_TEXT,
        },
      }
      : { accepted: false };
  },
  buildSpec: ({ draft, setDraft }) => ({
    id: "project-terminal-settings",
    title: "TERMINAL",
    context: "Project-wide player terminal",
    blocks: [{
      type: "section",
      id: "project-terminal-prompt",
      label: "PROMPT",
      importance: "primary",
      children: [{
        type: "field",
        id: "project-terminal-prompt-value",
        label: "Player prompt",
        value: draft.terminalPrompt,
        maxLength: 32,
        onChange: (terminalPrompt) => setDraft({ ...draft, terminalPrompt }),
        autoCapitalize: "none",
        autoCorrect: "off",
        spellCheck: false,
        help: "Player-facing prompt text for this game. Maximum 32 characters.",
      }],
    }, {
      type: "disclosure",
      id: "project-terminal-advanced",
      label: "ADVANCED",
      summary: "Optional authored presentation details for the player terminal.",
      children: [{
        type: "section",
        id: "project-terminal-suggestion-menu",
        label: "SUGGESTION MENU",
        importance: "secondary",
        children: [{
          type: "field",
          id: "project-terminal-suggestion-menu-help-text",
          label: "Info text",
          control: "textarea",
          rows: 4,
          value: draft.suggestionMenuHelpText,
          maxLength: MAX_SUGGESTION_HELP_TEXT_LENGTH,
          onChange: (suggestionMenuHelpText) => setDraft({ ...draft, suggestionMenuHelpText }),
          autoCapitalize: "sentences",
          autoCorrect: "on",
          spellCheck: true,
          help: "Text shown from the expanded suggestion menu's [i] affordance. Leave this as null to show no info affordance to players.",
        }],
      }],
    }],
  }),
});

export const PROJECT_GENERAL_SETTINGS: readonly AuthorProjectSettingsSection[] = [{
  id: "project-terminal",
  label: "TERMINAL",
  description: "Project-wide player terminal identity and presentation defaults.",
  order: 10,
  route: { type: "feature", feature: "project", workspace: "terminal-settings" },
}];
