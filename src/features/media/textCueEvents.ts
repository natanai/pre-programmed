import type { TextCue } from "../narrative/model";
import type { MediaEffectEvent } from "./effectEvents";

/** Media's optional extension from Narrative performance cues into Media events. */
export function mediaEffectEventsForTextCue(cue: TextCue): MediaEffectEvent[] {
  if (typeof cue.value !== "string") return [];
  switch (cue.type) {
    case "synth":
      return [{ type: "synth", synthId: cue.value }];
    case "audio":
      return [{ type: "audio", assetPath: cue.value }];
    case "sprite":
      return [{ type: "art", assetPath: cue.value }];
    default:
      return [];
  }
}
