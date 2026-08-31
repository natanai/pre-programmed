import type { Effect } from "./model";
import type { PlayState, ProjectSnapshot } from "../project/model";

export type EffectEvent =
  | { type: "notification"; text: string }
  | { type: "synth"; synthId: string }
  | { type: "audio"; assetPath: string }
  | { type: "art"; assetPath: string };

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
