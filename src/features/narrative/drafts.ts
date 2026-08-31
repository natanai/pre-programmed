import { ALWAYS } from "../../engine/rules/model";
import type { Interaction, InteractionOutcome } from "./model";

export function createDraftOutcome(order = 0, responseText = ""): InteractionOutcome {
  return {
    id: crypto.randomUUID(),
    order,
    label: order === 0 ? "default" : `response ${order + 1}`,
    authorStatus: "draft",
    condition: ALWAYS,
    responseText,
    responseCharactersPerSecond: 18,
    effects: [],
    disposition: "stay",
    destinationNodeId: null,
  };
}

export function createDraftInteraction(sourceNodeId: string, command = "", fallback = false): Interaction {
  return {
    id: crypto.randomUUID(),
    sourceNodeId,
    wording: fallback ? "" : command,
    matchMode: fallback ? "fallback" : "command",
    choiceVisibility: fallback ? "typed" : "prompt",
    aliases: fallback ? [] : command ? [command] : [],
    tags: [],
    notes: "",
    outcomes: [createDraftOutcome()],
  };
}
