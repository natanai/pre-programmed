import type { AuthorProjectSettingsSection } from "../features/types";
import { AuthorHelp } from "../ui/AuthorHelp";
import { ValueMentionField } from "../ValueMentionField";
import { MAX_TERMINAL_PROMPT_LENGTH } from "../../engine/project/settings";
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
  canSave: ({ draft }) => Boolean(draft.terminalPrompt.trim()) && draft.terminalPrompt.length <= MAX_TERMINAL_PROMPT_LENGTH,
  save: async ({ context, draft }) => {
    const terminalPrompt = draft.terminalPrompt;
    if (!terminalPrompt.trim() || terminalPrompt.length > MAX_TERMINAL_PROMPT_LENGTH) return { accepted: false };

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
  buildSpec: ({ draft, setDraft, context }) => ({
    id: "project-terminal-settings",
    title: "TERMINAL",
    context: "Project-wide player terminal",
    blocks: [{
      type: "section",
      id: "project-terminal-prompt",
      label: "PROMPT",
      importance: "primary",
      children: [{
        type: "custom",
        id: "project-terminal-prompt-value",
        role: "specialized-control",
        content: <div className="author-ui-field">
          <div className="author-ui-field-heading"><span className="author-ui-label author-ui-label-always">Player prompt</span><AuthorHelp label="About the Player prompt" text="Type @ to insert a variable or other reference. The current value appears in play. Spaces, including trailing spaces, are kept." /></div>
          <ValueMentionField
            snapshot={context.snapshot}
            playState={context.playState}
            value={draft.terminalPrompt}
            onValueChange={(terminalPrompt) => setDraft({ ...draft, terminalPrompt })}
            ariaLabel="Player prompt"
          />
          {draft.terminalPrompt.length > MAX_TERMINAL_PROMPT_LENGTH
            ? <small className="author-ui-help" role="alert">Prompt is too long (maximum {MAX_TERMINAL_PROMPT_LENGTH} stored characters).</small>
            : null}
        </div>,
      }],
    }, {
      type: "disclosure",
      id: "project-terminal-advanced",
      label: "ADVANCED",
      summary: "Suggestion menu",
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
  id: "project-defaults",
  label: "TEXT & INPUTS",
  description: "Starting text speed, input visibility, and response selection for newly authored content.",
  order: 0,
  group: "defaults",
  route: { type: "feature", feature: "project", workspace: "defaults" },
}, {
  id: "project-terminal",
  label: "TERMINAL",
  description: "Project-wide player terminal identity and presentation defaults.",
  order: 10,
  route: { type: "feature", feature: "project", workspace: "terminal-settings" },
}];
