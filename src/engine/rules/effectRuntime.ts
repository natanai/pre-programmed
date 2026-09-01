import type { MediaEffectEvent } from "../../features/media/effectEvents";
import type { Effect } from "./model";
import type { PlayState, ProjectSnapshot } from "../project/model";

/** Presentation events that remain available without optional features. */
export type CoreEffectEvent = { type: "notification"; text: string };

/**
 * Runtime events are contributed by installed features. Engine Rules owns the
 * execution envelope; feature modules own the payloads their effects emit.
 */
export type EffectEvent = CoreEffectEvent | MediaEffectEvent;

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
