import type { TextCue } from "../../features/narrative/model";
import type { EffectEvent } from "../rules/effectRuntime";

export type TextCueEventContribution = (cue: TextCue) => readonly EffectEvent[];

const TEXT_CUE_EVENT_CONTRIBUTIONS: readonly TextCueEventContribution[] = [];

export function effectEventsForTextCue(cue: TextCue): EffectEvent[] {
  return TEXT_CUE_EVENT_CONTRIBUTIONS.flatMap((contribution) => contribution(cue));
}
