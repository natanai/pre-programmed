import type { ProjectDefaults } from "../../engine/project/defaults";
import { defineAuthorWorkspace } from "../ui/workspaceDefinition";

export const projectDefaultsWorkspace = defineAuthorWorkspace<ProjectDefaults>({
  id: "project-defaults",
  matches: (route) => route.type === "feature" && route.feature === "project" && route.workspace === "defaults",
  createDraft: (_route, context) => ({ ...context.snapshot.settings.defaults }),
  canSave: ({ draft }) => Number.isInteger(draft.textSpeed) && draft.textSpeed >= 1 && draft.textSpeed <= 120,
  save: async ({ context, draft }) => {
    const settings = { ...context.snapshot.settings, defaults: { ...draft } };
    const result = await context.persist([{ type: "project.settings", settings }], "Changed project authoring defaults");
    return result.status === "saved" || result.status === "queued"
      ? { accepted: true, draft: { ...draft } }
      : { accepted: false };
  },
  buildSpec: ({ draft, setDraft }) => ({
    id: "project-defaults",
    title: "TEXT & INPUT DEFAULTS",
    blocks: [{
      type: "section",
      id: "defaults-text",
      label: "TEXT",
      importance: "primary",
      children: [{
        type: "field",
        id: "defaults-text-speed",
        label: "TEXT SPEED (CHARACTERS / SECOND)",
        control: "number",
        inputMode: "numeric",
        value: draft.textSpeed,
        onChange: (value) => {
          const parsed = Number(value);
          setDraft({ ...draft, textSpeed: Number.isFinite(parsed) ? Math.max(1, Math.min(120, Math.round(parsed))) : draft.textSpeed });
        },
        help: "Initial speed for new Node text, dialogue, responses, follow-up text, and Player Command responses. Existing authored speeds stay unchanged.",
      }],
    }, {
      type: "section",
      id: "defaults-inputs",
      label: "PLAYER INPUTS",
      children: [{
        type: "choice",
        id: "defaults-input-visibility",
        label: "NEW INPUT VISIBILITY",
        value: draft.inputVisibility,
        onChange: (inputVisibility) => setDraft({ ...draft, inputVisibility: inputVisibility as ProjectDefaults["inputVisibility"] }),
        presentation: "stacked",
        options: [
          { value: "immediate", label: "IMMEDIATE" },
          { value: "prompt", label: "PROMPT" },
          { value: "typed", label: "TYPED ONLY" },
        ],
      }, {
        type: "choice",
        id: "defaults-response-selection",
        label: "NEW INPUT RESPONSE SELECTION",
        value: draft.responseSelection,
        onChange: (responseSelection) => setDraft({ ...draft, responseSelection: responseSelection === "random" ? "random" : "first" }),
        presentation: "stacked",
        options: [
          { value: "first", label: "FIRST MATCHING" },
          { value: "random", label: "RANDOM MATCHING" },
        ],
      }],
    }],
  }),
});
