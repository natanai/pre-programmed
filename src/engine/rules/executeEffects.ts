import { EFFECT_HANDLERS } from "./effectCatalog";
import type { Effect } from "./model";
import type { PlayState, ProjectSnapshot } from "../project/model";
import type { EffectExecution, EffectEvent } from "./effectRuntime";
import type { RuleRuntimeContext } from "./runtimeBindings";

/** Execute an ordered effect list through the feature-contributed effect catalog. */
export function executeEffects(
  snapshot: ProjectSnapshot,
  initialState: PlayState,
  effects: Effect[],
  context: RuleRuntimeContext = {},
): EffectExecution {
  let state: PlayState = initialState;
  const events: EffectEvent[] = [];

  for (const effect of effects) {
    const handler = EFFECT_HANDLERS[effect.type];
    if (!handler) continue;
    const execution = handler(effect, snapshot, state, context);
    state = execution.state;
    events.push(...execution.events);
  }

  return { state, events };
}
