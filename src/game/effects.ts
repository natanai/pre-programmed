import { EFFECT_HANDLERS } from "../engine/rules/effectCatalog";
import type { EffectExecution, EffectEvent } from "../engine/rules/effectRuntime";
import type { Effect, PlayState, ProjectSnapshot } from "./model";

export type { EffectExecution, EffectEvent } from "../engine/rules/effectRuntime";
export { transitionState } from "../features/narrative/effectRuntime";

export function executeEffects(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  effects: Effect[],
): EffectExecution {
  let state: PlayState = initialState;
  const events: EffectEvent[] = [];

  for (const effect of effects) {
    const handler = EFFECT_HANDLERS[effect.type];
    if (!handler) continue;
    const execution = handler(effect, snapshot, state);
    state = execution.state;
    events.push(...execution.events);
  }

  return { state, events };
}
