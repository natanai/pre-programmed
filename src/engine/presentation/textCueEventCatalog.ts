import type { TextCue } from "../../features/narrative/model";
import type { EffectEvent } from "../rules/effectRuntime";

export type TextCueEventContribution = (cue: TextCue) => readonly EffectEvent[];

/** Explicit composition root for optional feature meanings attached to text cues. */
const TEXT_CUE_EVENT_CONTRIBUTIONS: readonly TextCueEventContribution[] = [];

export function effectEventsForTextCue(cue: TextCue): EffectEvent[] {
  return TEXT_CUE_EVENT_CONTRIBUTIONS.flatMap((contribution) => contribution(cue));
}
