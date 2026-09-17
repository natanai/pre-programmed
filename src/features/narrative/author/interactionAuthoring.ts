import { ALWAYS } from "../../../engine/rules/model";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { createDraftInteraction, createDraftOutcome } from "../drafts";
import type { Interaction, NarrativeFlowStep, NodeEntryTarget } from "../model";
import { normalizeInteractionOutcomeProse } from "../interactionProse";
import { validateTextNotation } from "../textNotation";

export type InteractionSaveIssue = {
  message: string;
  outcomeId?: string;
};

export function interactionAuthorLabel(interaction: Interaction) {
  if (interaction.matchMode === "fallback") return "Invalid input response";
  return interaction.wording || interaction.aliases[0] || "New scene input";
}

export function aliasesForUserInput(userInputText: string, aliases: string[]) {
  const trimmed = userInputText.trim();
  const values = [trimmed, ...aliases.map((alias) => alias.trim())].filter(Boolean);
  const seen = new Set<string>();
  return values.filter((alias) => {
    const normalized = alias.toLocaleLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function normalizeInteractionAuthorDraft(
  initial: Interaction | undefined,
  sourceNodeId: string,
  command: string,
  fallback: boolean,
) {
  const value = structuredClone(initial ?? createDraftInteraction(sourceNodeId, command, fallback));
  value.matchMode = fallback ? "fallback" : "command";
  value.choiceVisibility ??= fallback ? "typed" : "prompt";
  value.choiceVisibleWhen ??= ALWAYS;
  value.outcomes = value.outcomes.length ? value.outcomes.map((outcome) => normalizeInteractionOutcomeProse({
    ...outcome,
    after: Array.isArray(outcome.after) ? outcome.after : [],
    authorStatus: outcome.authorStatus ?? "configured",
  })) : [createDraftOutcome()];
  return value;
}

function destinationExists(snapshot: ProjectSnapshot, destination: NodeEntryTarget) {
  const node = snapshot.nodes.find((candidate) => candidate.id === destination.nodeId);
  if (!node) return false;
  return !destination.openingId || node.openings.some((opening) => opening.id === destination.openingId);
}

function invalidFlowDestination(snapshot: ProjectSnapshot, flow: NarrativeFlowStep[]) {
  return flow.find((step) => step.type === "transition" && !destinationExists(snapshot, step.destination));
}

function flowTextInvalid(flow: NarrativeFlowStep[]) {
  return flow.some((step) => step.type === "present" && (
    validateTextNotation(step.responseText).length
    || validateTextNotation(step.dialogueText).length
  ));
}

export function prepareInteractionForSave(
  draft: Interaction,
  fallbackMode: boolean,
  snapshot: ProjectSnapshot,
): { interaction: Interaction } | { issue: InteractionSaveIssue } {
  const userInputText = draft.wording.trim();

  if (!fallbackMode && !userInputText) {
    return { issue: { message: "Enter user-input-text." } };
  }

  const invalidDestination = draft.outcomes.find((outcome) => invalidFlowDestination(snapshot, outcome.after));
  if (invalidDestination) {
    return {
      issue: {
        message: "This response no longer points to a valid Node entry. Choose AUTO or one of that Node's current entry responses.",
        outcomeId: invalidDestination.id,
      },
    };
  }

  const invalidText = draft.outcomes.find((outcome) =>
    validateTextNotation(outcome.responseText).length
    || validateTextNotation(outcome.dialogueText ?? "").length
    || flowTextInvalid(outcome.after));
  if (invalidText) {
    return {
      issue: {
        message: "Fix the response text rule error before saving.",
        outcomeId: invalidText.id,
      },
    };
  }

  return {
    interaction: {
      ...draft,
      wording: fallbackMode ? "" : userInputText,
      matchMode: fallbackMode ? "fallback" : "command",
      choiceVisibility: fallbackMode ? "typed" : draft.choiceVisibility,
      choiceVisibleWhen: fallbackMode ? ALWAYS : (draft.choiceVisibleWhen ?? ALWAYS),
      aliases: fallbackMode ? [] : aliasesForUserInput(userInputText, draft.aliases),
      outcomes: draft.outcomes.map((outcome, index) => ({
        ...outcome,
        order: index,
        after: structuredClone(outcome.after),
      })),
    },
  };
}

export function interactionSaveDescription(
  interaction: Interaction,
  existedBeforeSave: boolean,
  fallbackMode: boolean,
  snapshot: ProjectSnapshot,
) {
  const sourceNodeNumber = snapshot.nodes.find((node) => node.id === interaction.sourceNodeId)?.nodeNumber;
  if (fallbackMode) return `${existedBeforeSave ? "Changed" : "Created"} invalid-input response for node ${sourceNodeNumber}`;
  return existedBeforeSave
    ? `Changed user input ${interaction.wording}`
    : `Created user input ${interaction.wording}`;
}
