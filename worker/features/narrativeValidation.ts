import { conditionValid, effectsValid, object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function textPerformanceValid(value: unknown) {
  return object(value)
    && Number.isInteger(value.charactersPerSecond)
    && (value.charactersPerSecond as number) >= 1
    && (value.charactersPerSecond as number) <= 120
    && Array.isArray(value.cues);
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

      const conversationMode = operation.node.conversationMode;
      if (conversationMode !== undefined) {
        if (!["set", "continue", "clear"].includes(String(conversationMode))) {
          return "Node conversation behavior is invalid.";
        }
        if (conversationMode === "set") {
          if (typeof operation.node.conversationCharacterId !== "string"
            || !operation.node.conversationCharacterId
            || operation.node.conversationCharacterId.length > 128) {
            return "A conversation needs one Character.";
          }
        } else if (operation.node.conversationCharacterId !== null
          && operation.node.conversationCharacterId !== undefined) {
          return "Continue and Clear conversations cannot store a Character id.";
        }
      }

      if (operation.node.dialogueText !== undefined
        && (typeof operation.node.dialogueText !== "string" || operation.node.dialogueText.length > 20000)) {
        return "Node dialogue text is invalid.";
      }
      if (operation.node.dialoguePerformance !== undefined && !textPerformanceValid(operation.node.dialoguePerformance)) {
        return "Node dialogue performance is invalid.";
      }
      if (conversationMode === "clear" && typeof operation.node.dialogueText === "string" && operation.node.dialogueText.trim()) {
        return "A Node that ends the conversation cannot also contain conversation dialogue.";
      }
      if (operation.node.entryEffects !== undefined && !effectsValid(operation.node.entryEffects)) {
        return "Node entry effects are invalid.";
      }

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
      if (!validLegacyQueuedOutcome && !textPerformanceValid(performance)) {
        return "Response text performance is invalid.";
      }
      if (candidate.dialogueText !== undefined
        && (typeof candidate.dialogueText !== "string" || candidate.dialogueText.length > 20000)) {
        return "Response dialogue text is invalid.";
      }
      if (candidate.dialoguePerformance !== undefined && !textPerformanceValid(candidate.dialoguePerformance)) {
        return "Response dialogue performance is invalid.";
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
