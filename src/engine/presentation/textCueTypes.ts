/** Cue semantics owned by the core text renderer rather than an optional feature. */
export type CoreTextCueType =
  | "pause"
  | "speed"
  | "wave"
  | "shake"
  | "blink"
  | "instant";

export type TextCueType = CoreTextCueType;
