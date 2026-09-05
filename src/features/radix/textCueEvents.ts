import type { TextCue } from "../narrative/model";
import type { EffectEvent } from "../../engine/rules/effectRuntime";

export function radixEffectEventsForTextCue(cue: TextCue): EffectEvent[] {
  if (cue.type !== "radix" || typeof cue.value !== "string" || !cue.value.trim()) return [];
  return [{ type: "radix", sequenceId: cue.value.trim() }];
}
