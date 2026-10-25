import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { StateVariableDefaults } from "../projectSettings";

export const variableDefaultsWorkspace = defineAuthorWorkspace<StateVariableDefaults>({
  id: "state-variable-defaults",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "variable-defaults",
  createDraft: (_route, context) => ({ ...context.snapshot.settings.variableDefaults }),
  save: async ({ context, draft }) => {
    const settings = { ...context.snapshot.settings, variableDefaults: { ...draft } };
    const result = await context.persist([{ type: "project.settings", settings }], "Changed state variable defaults");
    return result.status === "saved" || result.status === "queued" ? { accepted: true, draft } : { accepted: false };
  },
  buildSpec: ({ draft, setDraft }) => ({
    id: "state-variable-defaults",
    title: "NEW VARIABLE DEFAULTS",
    blocks: [{
      type: "section",
      id: "state-variable-default-values",
      label: "INITIAL VALUES",
      children: [
        { type: "field", id: "state-default-number", label: "NUMBER", control: "number", inputMode: "decimal", value: draft.numberValue, onChange: (value) => setDraft({ ...draft, numberValue: Number.isFinite(Number(value)) ? Number(value) : draft.numberValue }) },
        { type: "toggle", id: "state-default-flag", label: "FLAG", checked: draft.flagValue, onChange: (flagValue) => setDraft({ ...draft, flagValue }) },
        { type: "field", id: "state-default-text", label: "TEXT", value: draft.textValue, maxLength: 1000, onChange: (textValue) => setDraft({ ...draft, textValue }) },
      ],
    }, {
      type: "section",
      id: "state-variable-default-time",
      label: "TIMED VARIABLES",
      children: [
        { type: "field", id: "state-default-rate", label: "RATE", control: "number", inputMode: "decimal", value: draft.timeRate, onChange: (value) => setDraft({ ...draft, timeRate: Number.isFinite(Number(value)) ? Number(value) : draft.timeRate }) },
        { type: "choice", id: "state-default-unit", label: "PER", value: draft.timeUnit, onChange: (timeUnit) => setDraft({ ...draft, timeUnit: timeUnit === "minute" || timeUnit === "hour" ? timeUnit : "second" }), options: [
          { value: "second", label: "SECOND" },
          { value: "minute", label: "MINUTE" },
          { value: "hour", label: "HOUR" },
        ] },
        { type: "toggle", id: "state-default-interactable", label: "ENABLE PLAYER OPERATIONS", checked: draft.interactable, onChange: (interactable) => setDraft({ ...draft, interactable }) },
      ],
    }],
  }),
});
