import { ALWAYS } from "../../engine/rules/model";
import { DEFAULT_PROJECT_DEFAULTS, type ProjectDefaults } from "../../engine/project/defaults";
import type { Interaction, InteractionOutcome } from "./model";

export function createDraftOutcome(order = 0, responseText = "", textSpeed = DEFAULT_PROJECT_DEFAULTS.textSpeed): InteractionOutcome {
  return {
    id: crypto.randomUUID(),
    order,
    label: order === 0 ? "default" : `response ${order + 1}`,
    authorStatus: "draft",
    condition: ALWAYS,
    responseText,
    dialogueText: "",
    speakerId: null,
    responsePerformance: { charactersPerSecond: textSpeed, cues: [] },
    dialoguePerformance: { charactersPerSecond: textSpeed, cues: [] },
    effects: [],
    after: [],
  };
}

export function createDraftInteraction(sourceNodeId: string, command = "", fallback = false, defaults: ProjectDefaults = DEFAULT_PROJECT_DEFAULTS): Interaction {
  return {
    id: crypto.randomUUID(),
    sourceNodeId,
    order: 0,
    wording: fallback ? "" : command,
    matchMode: fallback ? "fallback" : "command",
    outcomeSelection: defaults.responseSelection,
    choiceVisibility: fallback ? "typed" : defaults.inputVisibility,
    choiceVisibleWhen: ALWAYS,
    aliases: fallback ? [] : command ? [command] : [],
    tags: [],
    notes: "",
    outcomes: [createDraftOutcome(0, "", defaults.textSpeed)],
  };
}
