import { conditionValid, effectsValid, object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function textPerformanceValid(value: unknown) {
  return object(value)
    && Number.isInteger(value.charactersPerSecond)
    && (value.charactersPerSecond as number) >= 1
    && (value.charactersPerSecond as number) <= 120
    && Array.isArray(value.cues);
}

function destinationValid(value: unknown) {
  return object(value)
    && typeof value.nodeId === "string" && Boolean(value.nodeId)
    && (value.openingId === null
      || value.openingId === undefined
      || (typeof value.openingId === "string" && Boolean(value.openingId)));
}

function flowValid(value: unknown) {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const [index, step] of value.entries()) {
    if (!object(step) || typeof step.id !== "string" || !step.id || ids.has(step.id)) return false;
    ids.add(step.id as string);
    if (step.type === "await_input") continue;
    if (step.type === "effects") {
      if (!effectsValid(step.effects)) return false;
      continue;
    }
    if (step.type === "transition") {
      if (!destinationValid(step.destination) || index !== value.length - 1) return false;
      continue;
    }
    if (step.type === "present") {
      if (typeof step.responseText !== "string" || step.responseText.length > 20000
        || typeof step.dialogueText !== "string" || step.dialogueText.length > 20000
        || !textPerformanceValid(step.responsePerformance)
        || !textPerformanceValid(step.dialoguePerformance)
        || (step.speakerId !== null && step.speakerId !== undefined
          && (typeof step.speakerId !== "string" || step.speakerId.length > 128))) {
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
}

export const narrativeMutationValidator: WorkerMutationValidator = {
  types: ["node.upsert", "interaction.upsert", "interaction.reorder", "interaction.delete"],
  validate(operation) {
    if (operation.type === "node.upsert") {
      if (!object(operation.node)) return "Node is invalid.";
      if (typeof operation.node.authorLabel !== "string" || operation.node.authorLabel.length > 4000) {
        return "Node author label is invalid.";
      }
      if (!Array.isArray(operation.node.openings) || operation.node.openings.length < 1) {
        return "A Node needs at least one entry response.";
      }
      const openingIds = new Set<string>();
      for (const candidate of operation.node.openings) {
        if (!object(candidate)
          || typeof candidate.id !== "string" || !candidate.id
          || !Number.isInteger(candidate.order) || (candidate.order as number) < 0
          || !conditionValid(candidate.condition)
          || typeof candidate.narrationText !== "string" || candidate.narrationText.length > 20000
          || typeof candidate.dialogueText !== "string" || candidate.dialogueText.length > 20000
          || !textPerformanceValid(candidate.narrationPerformance)
          || !textPerformanceValid(candidate.dialoguePerformance)
          || !flowValid(candidate.after)) {
          return "A Node entry response is invalid.";
        }
        if (openingIds.has(candidate.id as string)) return "Node entry response ids must be unique.";
        openingIds.add(candidate.id as string);
      }

      const locationMode = operation.node.locationMode;
      if (locationMode !== undefined) {
        if (!["set", "continue", "clear"].includes(String(locationMode))) return "Node location behavior is invalid.";
        if (locationMode === "set") {
          if (typeof operation.node.locationId !== "string" || !operation.node.locationId) return "Set Node locations need a Location.";
        } else if (operation.node.locationId !== null && operation.node.locationId !== undefined) {
          return "Continue and Clear Node locations cannot store a Location id.";
        }
      }

      const conversationMode = operation.node.conversationMode;
      if (conversationMode !== undefined) {
        if (!["set", "continue", "clear"].includes(String(conversationMode))) return "Node conversation behavior is invalid.";
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
      if (conversationMode === "clear" && operation.node.openings.some((candidate) => object(candidate) && typeof candidate.dialogueText === "string" && candidate.dialogueText.trim())) {
        return "A Node that ends the conversation cannot also contain conversation dialogue.";
      }
      if (operation.node.entryEffects !== undefined && !effectsValid(operation.node.entryEffects)) return "Node entry effects are invalid.";

      const anchor = operation.node.anchor;
      if (anchor === undefined) return null;
      if (!object(anchor) || !["set", "continue", "clear"].includes(String(anchor.mode))) return "Node anchor behavior is invalid.";
      if (typeof anchor.text !== "string" || anchor.text.length > 4000) return "Node anchor text is invalid.";
      if (anchor.mode === "set" && !anchor.text.trim()) return "Set anchors need text.";
      return null;
    }

    if (operation.type === "interaction.reorder") {
      if (typeof operation.sourceNodeId !== "string" || !operation.sourceNodeId || operation.sourceNodeId.length > 128) {
        return "Interaction order needs a source Node.";
      }
      if (!Array.isArray(operation.interactionIds)
        || operation.interactionIds.some((id) => typeof id !== "string" || !id || id.length > 128)) {
        return "Interaction order is invalid.";
      }
      if (new Set(operation.interactionIds).size !== operation.interactionIds.length) return "Interaction order cannot contain duplicate inputs.";
      return null;
    }

    if (operation.type !== "interaction.upsert" || !object(operation.interaction)) return null;
    const interaction = operation.interaction;

    if (interaction.order !== undefined && (!Number.isInteger(interaction.order) || (interaction.order as number) < 0)) return "Interaction order is invalid.";
    if (interaction.choiceVisibility !== undefined && !["immediate", "prompt", "typed"].includes(String(interaction.choiceVisibility))) return "Interaction choice visibility is invalid.";
    if (interaction.choiceVisibleWhen !== undefined && !conditionValid(interaction.choiceVisibleWhen)) return "Interaction choice visibility condition is invalid.";
    if (interaction.matchMode !== undefined && !["command", "fallback"].includes(String(interaction.matchMode))) return "Interaction match mode is invalid.";

    const outcomes = Array.isArray(interaction.outcomes) ? interaction.outcomes : [];
    for (const candidate of outcomes) {
      if (!object(candidate) || !conditionValid(candidate.condition) || !effectsValid(candidate.effects) || !flowValid(candidate.after)) {
        return "A condition, effect sequence, or continuation flow is invalid.";
      }
      if (candidate.authorStatus !== undefined && !["draft", "configured"].includes(String(candidate.authorStatus))) return "Interaction outcome author status is invalid.";
      const performance = candidate.responsePerformance;
      const legacySpeed = candidate.responseCharactersPerSecond;
      const validLegacyQueuedOutcome = performance === undefined
        && (legacySpeed === undefined || (Number.isInteger(legacySpeed) && (legacySpeed as number) >= 1 && (legacySpeed as number) <= 120));
      if (!validLegacyQueuedOutcome && !textPerformanceValid(performance)) return "Response text performance is invalid.";
      if (candidate.dialogueText !== undefined
        && (typeof candidate.dialogueText !== "string" || candidate.dialogueText.length > 20000)) return "Response dialogue text is invalid.";
      if (candidate.dialoguePerformance !== undefined && !textPerformanceValid(candidate.dialoguePerformance)) return "Response dialogue performance is invalid.";
      if (candidate.speakerId !== undefined && candidate.speakerId !== null && (
        typeof candidate.speakerId !== "string" || candidate.speakerId.length > 128
      )) return "Interaction response speaker is invalid.";
    }
    return null;
  },
};
