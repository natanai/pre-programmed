import type { AuthorProjectSettingsSection } from "../features/types";
import { defineAuthorWorkspace } from "../ui/workspaceDefinition";

export const projectTerminalSettingsWorkspace = defineAuthorWorkspace<string>({
  id: "project-terminal-settings",
  matches: (route) => route.type === "feature" && route.feature === "project" && route.workspace === "terminal-settings",
  createDraft: (_route, context) => context.snapshot.settings.terminalPrompt,
  canSave: ({ draft }) => Boolean(draft.trim()),
  save: async ({ context, draft }) => {
    const terminalPrompt = draft.trim().slice(0, 32);
    if (!terminalPrompt) return { accepted: false };
    const settings = { ...context.snapshot.settings, terminalPrompt };
    const result = await context.persist(
      [{ type: "project.settings", settings }],
      "Changed project terminal settings",
    );
    return result.status === "saved" || result.status === "queued"
      ? { accepted: true, draft: terminalPrompt }
      : { accepted: false };
  },
  buildSpec: ({ draft, setDraft }) => ({
    id: "project-terminal-settings",
    title: "TERMINAL PROMPT",
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
        value: draft,
        onChange: setDraft,
        autoCapitalize: "none",
        autoCorrect: "off",
        spellCheck: false,
        help: "Player-facing prompt text for this game. Maximum 32 characters.",
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
