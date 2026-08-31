import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { executeEffects } from "../../engine/rules/executeEffects";
import type { EffectEvent } from "../../engine/rules/effectRuntime";
import { evaluateCondition } from "../../game/conditions";
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
  const execution = executeEffects(snapshot, state, outcome.effects);
  state = execution.state;

  if (outcome.disposition === "transition" && outcome.destinationNodeId) {
    state = transitionState(state, outcome.destinationNodeId);
  }

  return {
    state,
    outcome,
    responseText: interpolateText(outcome.responseText, { snapshot, state }),
    events: execution.events.map((event) =>
      event.type === "notification"
        ? { ...event, text: interpolateText(event.text, { snapshot, state }) }
        : event,
    ),
    attempt,
    eventKey,
  };
}
