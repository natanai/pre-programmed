import { authoredSource, type AuthoredSourceIdentity } from "../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { selectConditionalCandidate } from "../../engine/rules/conditionalSelection";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import { PLAYER_INPUT_BINDING } from "../../engine/rules/runtimeBindings";
import {
  advanceNarrativeFlow,
  armNarrativeFlow,
} from "./flowRuntime";
import { DEFAULT_INTERACTION_TEXT_PERFORMANCE, interactionOutcomeProse } from "./interactionProse";
import { interpolateText } from "./interpolation";
import type { Interaction, InteractionOutcome, NarrativeFlowOwner, TextPerformance } from "./model";
import { executeNodeEntryEffects } from "./nodeEntryRuntime";
import { resolveNodeConversationContext } from "./sceneContext";

export { executeNodeEntryEffects } from "./nodeEntryRuntime";

export type InteractionExecution = {
  state: PlayState;
  outcome: InteractionOutcome | null;
  responseText: string;
  responsePerformance: TextPerformance;
  dialogueText: string;
  dialoguePerformance: TextPerformance;
  dialogueSpeakerId: string | null;
  events: EffectEvent[];
  attempt: number;
  eventKey: string;
  source?: AuthoredSourceIdentity;
};

function blankExecution(state: PlayState, attempt: number, eventKey: string): InteractionExecution {
  return {
    state,
    outcome: null,
    responseText: "",
    responsePerformance: { ...DEFAULT_INTERACTION_TEXT_PERFORMANCE, cues: [] },
    dialogueText: "",
    dialoguePerformance: { ...DEFAULT_INTERACTION_TEXT_PERFORMANCE, cues: [] },
    dialogueSpeakerId: null,
    events: [],
    attempt,
    eventKey,
  };
}

export function executeInteraction(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  interaction: Interaction,
): InteractionExecution {
  const eventKey = `interaction:${interaction.id}`;
  const attempt = (initialState.attempts[eventKey] ?? 0) + 1;
  let state: PlayState = {
    ...initialState,
    attempts: { ...initialState.attempts, [eventKey]: attempt },
  };
  const scope = { kind: "node" as const, id: interaction.sourceNodeId };
  const outcome = selectConditionalCandidate(interaction.outcomes, {
    snapshot,
    state,
    eventKey,
    occurrence: attempt,
    scope,
  });

  if (!outcome) return blankExecution(state, attempt, eventKey);

  const prose = interactionOutcomeProse(outcome);
  const sourceConversation = resolveNodeConversationContext(snapshot, initialState, interaction.sourceNodeId);
  const effectSource = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });
  const execution = executeEffects(snapshot, state, outcome.effects, {
    bindings: { [PLAYER_INPUT_BINDING]: initialState.lastCommand },
    scope,
  });
  state = execution.state;

  const interactionEvents = execution.events.map((event) => {
    const next = event.type === "notification"
      ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
      : event;
    return { ...next, source: effectSource };
  });

  const responseText = interpolateText(prose.narrationText, { snapshot, state });
  const dialogueText = interpolateText(prose.dialogueText, { snapshot, state });
  const hasPrimaryPresentation = Boolean(responseText || dialogueText);
  const owner: NarrativeFlowOwner = {
    type: "interaction-outcome",
    interactionId: interaction.id,
    outcomeId: outcome.id,
  };

  if (outcome.after.length) {
    if (hasPrimaryPresentation) {
      state = armNarrativeFlow(state, owner, {
        [PLAYER_INPUT_BINDING]: initialState.lastCommand,
      });
    } else {
      const flowed = advanceNarrativeFlow(snapshot, state, owner, 0, {
        [PLAYER_INPUT_BINDING]: initialState.lastCommand,
      });
      return {
        state: flowed.state,
        outcome,
        responseText: flowed.responseText,
        responsePerformance: flowed.responsePerformance,
        dialogueText: flowed.dialogueText,
        dialoguePerformance: flowed.dialoguePerformance,
        dialogueSpeakerId: flowed.dialogueSpeakerId,
        events: [...interactionEvents, ...flowed.events],
        attempt,
        eventKey,
        source: flowed.source ?? effectSource,
      };
    }
  }

  const enteredNode = state.currentNodeId !== initialState.currentNodeId
    || state.traversal.length > initialState.traversal.length;
  const entry = enteredNode
    ? executeNodeEntryEffects(snapshot, state, state.currentNodeId)
    : { state, events: [] };
  state = entry.state;

  const presentationSource = responseText
    ? authoredSource("interaction", interaction.id, { outcomeId: outcome.id, section: "narration" })
    : dialogueText
      ? authoredSource("interaction", interaction.id, { outcomeId: outcome.id, section: "dialogue" })
      : effectSource;

  return {
    state,
    outcome,
    responseText,
    responsePerformance: prose.narrationPerformance,
    dialogueText,
    dialoguePerformance: prose.dialoguePerformance,
    dialogueSpeakerId: sourceConversation?.characterId ?? outcome.speakerId ?? null,
    events: [...interactionEvents, ...entry.events],
    attempt,
    eventKey,
    source: presentationSource,
  };
}
