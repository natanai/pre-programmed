import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { WorldDefaults } from "../projectSettings";

export const worldDefaultsWorkspace = defineAuthorWorkspace<WorldDefaults>({
  id: "world-defaults",
  matches: (route) => route.type === "feature" && route.feature === "world" && route.workspace === "defaults",
  createDraft: (_route, context) => ({ ...context.snapshot.settings.worldDefaults }),
  save: async ({ context, draft }) => {
    const settings = { ...context.snapshot.settings, worldDefaults: { ...draft } };
    const result = await context.persist([{ type: "project.settings", settings }], "Changed character and location defaults");
    return result.status === "saved" || result.status === "queued" ? { accepted: true, draft } : { accepted: false };
  },
  buildSpec: ({ draft, setDraft }) => ({
    id: "world-defaults",
    title: "CHARACTER & LOCATION DEFAULTS",
    blocks: [{
      type: "section",
      id: "world-defaults-fields",
      label: "NEW CHARACTERS & LOCATIONS",
      children: [{
        type: "choice",
        id: "world-default-name-mode",
        label: "CHARACTER STARTING NAME",
        value: draft.characterStartingNameSelection,
        onChange: (characterStartingNameSelection) => setDraft({
          ...draft,
          characterStartingNameSelection: characterStartingNameSelection === "random" ? "random" : "first",
        }),
        presentation: "stacked",
        options: [
          { value: "first", label: "CANONICAL NAME" },
          { value: "random", label: "RANDOM NAME OR ALIAS" },
        ],
      }, {
        type: "toggle",
        id: "world-default-interactable",
        label: "ENABLE PLAYER OPERATIONS BY DEFAULT",
        checked: draft.interactable,
        onChange: (interactable) => setDraft({ ...draft, interactable }),
      }],
    }],
  }),
});
