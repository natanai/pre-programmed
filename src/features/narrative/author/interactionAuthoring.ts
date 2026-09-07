import { ALWAYS } from "../../../engine/rules/model";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { createDraftInteraction, createDraftOutcome } from "../drafts";
import type { Interaction } from "../model";
import { normalizeInteractionOutcomeProse } from "../interactionProse";
import { validateTextNotation } from "../textNotation";

export type InteractionSaveIssue = {
  message: string;
  outcomeId?: string;
};

export function interactionAuthorLabel(interaction: Interaction) {
  if (interaction.matchMode === "fallback") return "Invalid input response";
  if (interaction.matchMode === "capture") return "Capture player input";
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
  value.matchMode ??= fallback ? "fallback" : "command";
  value.choiceVisibility ??= fallback ? "typed" : "prompt";
  value.choiceVisibleWhen ??= ALWAYS;
  value.outcomes = value.outcomes.length ? value.outcomes.map((outcome) => normalizeInteractionOutcomeProse({
    ...outcome,
    authorStatus: outcome.authorStatus ?? "configured",
  })) : [createDraftOutcome()];
  return value;
}

export function prepareInteractionForSave(
  draft: Interaction,
  fallbackMode: boolean,
  snapshot: ProjectSnapshot,
): { interaction: Interaction; captureMode: boolean } | { issue: InteractionSaveIssue } {
  const captureMode = !fallbackMode && draft.matchMode === "capture";
  const userInputText = draft.wording.trim();

  if (!fallbackMode && !captureMode && !userInputText) {
    return { issue: { message: "Enter user-input-text or choose Capture player input." } };
  }

  if (captureMode && snapshot.interactions.some((interaction) =>
    interaction.id !== draft.id
    && interaction.sourceNodeId === draft.sourceNodeId
    && interaction.matchMode === "capture")) {
    return { issue: { message: "This node already has a Capture player input interaction. Edit that interaction instead." } };
  }

  const incompleteTransition = draft.outcomes.find((outcome) =>
    outcome.disposition === "transition" && !outcome.destinationNodeId);
  if (incompleteTransition) {
    return {
      issue: {
        message: "Choose an existing destination or create a new Node before saving.",
        outcomeId: incompleteTransition.id,
      },
    };
  }

  const invalidText = draft.outcomes.find((outcome) =>
    validateTextNotation(outcome.responseText).length
    || validateTextNotation(outcome.dialogueText ?? "").length);
  if (invalidText) {
    return {
      issue: {
        message: "Fix the response text rule error before saving.",
        outcomeId: invalidText.id,
      },
    };
  }

  return {
    captureMode,
    interaction: {
      ...draft,
      wording: fallbackMode || captureMode ? "" : userInputText,
      matchMode: fallbackMode ? "fallback" : captureMode ? "capture" : "command",
      choiceVisibility: fallbackMode || captureMode ? "typed" : draft.choiceVisibility,
      choiceVisibleWhen: fallbackMode || captureMode ? ALWAYS : (draft.choiceVisibleWhen ?? ALWAYS),
      aliases: fallbackMode || captureMode ? [] : aliasesForUserInput(userInputText, draft.aliases),
      outcomes: draft.outcomes.map((outcome, index) => ({ ...outcome, order: index })),
    },
  };
}

export function interactionSaveDescription(
  interaction: Interaction,
  existedBeforeSave: boolean,
  fallbackMode: boolean,
  snapshot: ProjectSnapshot,
) {
  const captureMode = !fallbackMode && interaction.matchMode === "capture";
  const sourceNodeNumber = snapshot.nodes.find((node) => node.id === interaction.sourceNodeId)?.nodeNumber;
  if (fallbackMode) return `${existedBeforeSave ? "Changed" : "Created"} invalid-input response for node ${sourceNodeNumber}`;
  if (captureMode) return `${existedBeforeSave ? "Changed" : "Created"} player-input capture for node ${sourceNodeNumber}`;
  return existedBeforeSave
    ? `Changed user input ${interaction.wording}`
    : `Created user input ${interaction.wording}`;
}
