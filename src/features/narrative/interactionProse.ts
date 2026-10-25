import type { InteractionOutcome, TextPerformance } from "./model";
import { DEFAULT_PROJECT_DEFAULTS } from "../../engine/project/defaults";

export const DEFAULT_INTERACTION_TEXT_PERFORMANCE: TextPerformance = {
  charactersPerSecond: DEFAULT_PROJECT_DEFAULTS.textSpeed,
  cues: [],
};

export type InteractionOutcomeProse = {
  narrationText: string;
  narrationPerformance: TextPerformance;
  dialogueText: string;
  dialoguePerformance: TextPerformance;
};

export function interactionOutcomeProse(outcome: InteractionOutcome): InteractionOutcomeProse {
  const legacy = outcome as InteractionOutcome & {
    responseCharactersPerSecond?: number;
    responsePerformance?: TextPerformance;
  };
  const responsePerformance = legacy.responsePerformance ?? {
    charactersPerSecond: legacy.responseCharactersPerSecond ?? DEFAULT_PROJECT_DEFAULTS.textSpeed,
    cues: [],
  };
  const legacySpokenResponse = outcome.dialogueText === undefined && Boolean(outcome.speakerId);
  if (legacySpokenResponse) {
    return {
      narrationText: "",
      narrationPerformance: { ...DEFAULT_INTERACTION_TEXT_PERFORMANCE, cues: [] },
      dialogueText: outcome.responseText,
      dialoguePerformance: responsePerformance,
    };
  }
  return {
    narrationText: outcome.responseText,
    narrationPerformance: responsePerformance,
    dialogueText: outcome.dialogueText ?? "",
    dialoguePerformance: outcome.dialoguePerformance ?? { ...DEFAULT_INTERACTION_TEXT_PERFORMANCE, cues: [] },
  };
}

export function normalizeInteractionOutcomeProse(outcome: InteractionOutcome): InteractionOutcome {
  const prose = interactionOutcomeProse(outcome);
  return {
    ...outcome,
    responseText: prose.narrationText,
    responsePerformance: prose.narrationPerformance,
    dialogueText: prose.dialogueText,
    dialoguePerformance: prose.dialoguePerformance,
  };
}
