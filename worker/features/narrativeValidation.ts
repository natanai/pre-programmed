import { conditionValid, effectsValid, object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function characterContextError(value: unknown, label: string) {
  if (value === undefined) return null;
  if (!object(value) || !["set", "continue", "clear"].includes(String(value.mode))) {
    return `Node ${label} behavior is invalid.`;
  }
  if (!Array.isArray(value.characterIds)) return `Node ${label} characters are invalid.`;
  const ids = value.characterIds;
  if (ids.some((id) => typeof id !== "string" || !id || id.length > 128)) {
    return `Node ${label} characters are invalid.`;
  }
  if (new Set(ids).size !== ids.length) return `Node ${label} cannot contain the same character twice.`;
  if (value.mode === "set" && ids.length === 0) return `Set Node ${label} needs at least one character.`;
  if (value.mode !== "set" && ids.length > 0) return `Continue and Clear Node ${label} cannot store character ids.`;
  return null;
}

export const narrativeMutationValidator: WorkerMutationValidator = {
  types: ["node.upsert", "interaction.upsert", "interaction.delete"],
  validate(operation) {
    if (operation.type === "node.upsert") {
      if (!object(operation.node)) return "Node is invalid.";

      const locationMode = operation.node.locationMode;
      if (locationMode !== undefined) {
        if (!["set", "continue", "clear"].includes(String(locationMode))) {
          return "Node location behavior is invalid.";
        }
        if (locationMode === "set") {
          if (typeof operation.node.locationId !== "string" || !operation.node.locationId) {
            return "Set Node locations need a Location.";
          }
        } else if (operation.node.locationId !== null && operation.node.locationId !== undefined) {
          return "Continue and Clear Node locations cannot store a Location id.";
        }
      }

      const presentError = characterContextError(operation.node.presentCharacters, "characters-present");
      if (presentError) return presentError;
      const conversationError = characterContextError(operation.node.conversation, "conversation");
      if (conversationError) return conversationError;

      const anchor = operation.node.anchor;
      if (anchor === undefined) return null;
      if (!object(anchor) || !["set", "continue", "clear"].includes(String(anchor.mode))) {
        return "Node anchor behavior is invalid.";
      }
      if (typeof anchor.text !== "string" || anchor.text.length > 4000) {
        return "Node anchor text is invalid.";
      }
      if (anchor.mode === "set" && !anchor.text.trim()) {
        return "Set anchors need text.";
      }
      return null;
    }

    if (operation.type !== "interaction.upsert" || !object(operation.interaction)) return null;
    const interaction = operation.interaction;

    if (interaction.choiceVisibility !== undefined && !["immediate", "prompt", "typed"].includes(String(interaction.choiceVisibility))) {
      return "Interaction choice visibility is invalid.";
    }
    if (interaction.choiceVisibleWhen !== undefined && !conditionValid(interaction.choiceVisibleWhen)) {
      return "Interaction choice visibility condition is invalid.";
    }
    if (interaction.matchMode !== undefined && !["command", "capture", "fallback"].includes(String(interaction.matchMode))) {
      return "Interaction match mode is invalid.";
    }
    if (interaction.matchMode === "capture" && typeof interaction.wording === "string" && interaction.wording.trim()) {
      return "Capture interactions cannot store fixed player wording.";
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
