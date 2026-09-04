import { conditionValid, effectsValid, object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const narrativeMutationValidator: WorkerMutationValidator = {
  types: ["node.upsert", "interaction.upsert", "interaction.delete"],
  validate(operation) {
    if (operation.type !== "interaction.upsert" || !object(operation.interaction)) return null;
    const interaction = operation.interaction;

    if (interaction.choiceVisibility !== undefined && !["immediate", "prompt", "typed"].includes(String(interaction.choiceVisibility))) {
      return "Interaction choice visibility is invalid.";
    }
    if (interaction.choiceVisibleWhen !== undefined && !conditionValid(interaction.choiceVisibleWhen)) {
      return "Interaction choice visibility condition is invalid.";
    }
    if (interaction.matchMode !== undefined && !["command", "fallback"].includes(String(interaction.matchMode))) {
      return "Interaction match mode is invalid.";
    }

    const outcomes = Array.isArray(interaction.outcomes) ? interaction.outcomes : [];
    for (const candidate of outcomes) {
      if (!object(candidate) || !conditionValid(candidate.condition) || !effectsValid(candidate.effects)) {
        return "A condition or effect sequence is invalid.";
      }
      if (candidate.authorStatus !== undefined && !["draft", "configured"].includes(String(candidate.authorStatus))) {
        return "Interaction outcome author status is invalid.";
      }
      const performance = candidate.responsePerformance;
      const legacySpeed = candidate.responseCharactersPerSecond;
      const validLegacyQueuedOutcome = performance === undefined
        && (legacySpeed === undefined || (Number.isInteger(legacySpeed) && (legacySpeed as number) >= 1 && (legacySpeed as number) <= 120));
      if (!validLegacyQueuedOutcome && (!object(performance)
        || !Number.isInteger(performance.charactersPerSecond)
        || (performance.charactersPerSecond as number) < 1
        || (performance.charactersPerSecond as number) > 120
        || !Array.isArray(performance.cues))) {
        return "Response text performance is invalid.";
      }
      if (candidate.speakerId !== undefined && candidate.speakerId !== null && (
        typeof candidate.speakerId !== "string" || candidate.speakerId.length > 128
      )) {
        return "Interaction response speaker is invalid.";
      }
    }
    return null;
  },
};
