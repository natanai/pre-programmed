import { authoredSource, type AuthoredSourceIdentity } from "../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { evaluateCondition } from "../../engine/rules/conditions";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import { PLAYER_INPUT_BINDING } from "../../engine/rules/runtimeBindings";
import { transitionState } from "./effectRuntime";
import { interactionOutcomeProse } from "./interactionProse";
import { interpolateText } from "./interpolation";
import type { Interaction, InteractionOutcome } from "./model";
import { resolveNodeConversationContext } from "./sceneContext";

export type InteractionExecution = {
  state: PlayState;
  outcome: InteractionOutcome | null;
  responseText: string;
  dialogueText: string;
  dialogueSpeakerId: string | null;
  events: EffectEvent[];
  attempt: number;
  eventKey: string;
  source?: AuthoredSourceIdentity;
};

export type NodeEntryExecution = {
  state: PlayState;
  events: EffectEvent[];
};

/**
 * Executes the effects owned by a Node after runtime traversal enters it.
 * Entry effects may themselves transition, so follow that chain while keeping
 * each emitted presentation event attributed to the Node that produced it.
 */
export function executeNodeEntryEffects(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  nodeId = initialState.currentNodeId,
  maxDepth = 16,
): NodeEntryExecution {
  let state = initialState;
  const events: EffectEvent[] = [];
  let currentNodeId = nodeId;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const node = snapshot.nodes.find((candidate) => candidate.id === currentNodeId);
    if (!node) break;
    const source = authoredSource("node", node.id, { section: "entry-effects" });
    const execution = executeEffects(snapshot, state, node.entryEffects ?? []);
    state = execution.state;
    events.push(...execution.events.map((event) => {
      const next = event.type === "notification"
        ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
        : event;
      return { ...next, source };
    }));
    if (state.currentNodeId === currentNodeId) break;
    currentNodeId = state.currentNodeId;
  }

  return { state, events };
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
  const outcome = [...interaction.outcomes]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .find((candidate) => evaluateCondition(candidate.condition, { snapshot, state, eventKey })) ?? null;

  if (!outcome) return {
    state, outcome, responseText: "", dialogueText: "", dialogueSpeakerId: null, events: [], attempt, eventKey,
  };
  const prose = interactionOutcomeProse(outcome);
  const sourceConversation = resolveNodeConversationContext(snapshot, initialState, interaction.sourceNodeId);
  const source = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });
  const execution = executeEffects(snapshot, state, outcome.effects, {
    bindings: { [PLAYER_INPUT_BINDING]: initialState.lastCommand },
  });
  state = execution.state;

  if (outcome.disposition === "transition" && outcome.destinationNodeId) {
    state = transitionState(state, outcome.destinationNodeId);
  }

  const interactionEvents = execution.events.map((event) => {
    const next = event.type === "notification"
      ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
      : event;
    return { ...next, source };
  });
  const enteredNode = state.currentNodeId !== initialState.currentNodeId
    || state.traversal.length > initialState.traversal.length;
  const entry = enteredNode
    ? executeNodeEntryEffects(snapshot, state, state.currentNodeId)
    : { state, events: [] };
  state = entry.state;

  return {
    state,
    outcome,
    responseText: interpolateText(prose.narrationText, { snapshot, state }),
    dialogueText: interpolateText(prose.dialogueText, { snapshot, state }),
    dialogueSpeakerId: sourceConversation?.characterId ?? outcome.speakerId ?? null,
    events: [...interactionEvents, ...entry.events],
    attempt,
    eventKey,
    source,
  };
}
