import type { Effect } from "./model";
import type { PlayState, ProjectSnapshot } from "../project/model";

export type CoreEffectEvent = { type: "notification"; text: string };
export type EffectEvent = CoreEffectEvent;

export type EffectExecution = {
  state: PlayState;
  events: EffectEvent[];
};

export type EffectHandler = (
  effect: Effect,
  snapshot: ProjectSnapshot,
  state: PlayState,
) => EffectExecution;

export function unchangedEffect(state: PlayState): EffectExecution {
  return { state, events: [] };
}
