import { authoredSource, type AuthoredSourceIdentity } from "../../engine/presentation/authoredSource";
import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { evaluateCondition } from "../../engine/rules/conditions";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import { PLAYER_INPUT_BINDING } from "../../engine/rules/runtimeBindings";
import { transitionState } from "./effectRuntime";
import { interpolateText } from "./interpolation";
import type { Interaction, InteractionOutcome } from "./model";

export type InteractionExecution = {
  state: PlayState;
  outcome: InteractionOutcome | null;
  responseText: string;
  events: EffectEvent[];
  attempt: number;
  eventKey: string;
  source?: AuthoredSourceIdentity;
};

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

  if (!outcome) return { state, outcome, responseText: "", events: [], attempt, eventKey };
  const source = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });
  const execution = executeEffects(snapshot, state, outcome.effects, {
    bindings: { [PLAYER_INPUT_BINDING]: initialState.lastCommand },
  });
  state = execution.state;

  if (outcome.disposition === "transition" && outcome.destinationNodeId) {
    state = transitionState(state, outcome.destinationNodeId);
  }

  return {
    state,
    outcome,
    responseText: interpolateText(outcome.responseText, { snapshot, state }),
    events: execution.events.map((event) => {
      const next = event.type === "notification"
        ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
        : event;
      return { ...next, source };
    }),
    attempt,
    eventKey,
    source,
  };
}
