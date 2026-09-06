import type { AuthoredSourceIdentity } from "../presentation/authoredSource";
import type { MediaEffectEvent } from "../../features/media/effectEvents";
import type { RadixEffectEvent } from "../../features/radix/effectEvents";
import type { WorldEffectEvent } from "../../features/world/effectEvents";
import type { Effect } from "./model";
import type { PlayState, ProjectSnapshot } from "../project/model";
import type { RuleRuntimeContext } from "./runtimeBindings";

/** Presentation events that remain available without optional features. */
export type CoreEffectEvent =
  | { type: "notification"; text: string }
  | { type: "transcript"; text: string };

/**
 * Runtime events are contributed by installed features. Engine Rules owns the
 * execution envelope; feature modules own the payloads their effects emit.
 * Optional source identity is presentation metadata only: it lets Author mode
 * reopen the durable definition that produced a visible event.
 */
export type EffectEvent = (CoreEffectEvent | MediaEffectEvent | RadixEffectEvent | WorldEffectEvent) & {
  source?: AuthoredSourceIdentity;
};

export type EffectExecution = {
  state: PlayState;
  events: EffectEvent[];
};

export type EffectHandler = (
  effect: Effect,
  snapshot: ProjectSnapshot,
  state: PlayState,
  context: RuleRuntimeContext,
) => EffectExecution;

export function unchangedEffect(state: PlayState): EffectExecution {
  return { state, events: [] };
}
