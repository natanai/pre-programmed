import type { MediaTextCueType } from "../../features/media/textCueTypes";
import type { RadixTextCueType } from "../../features/radix/textCueTypes";

/** Cue semantics owned by the core text renderer rather than an optional feature. */
export type CoreTextCueType =
  | "pause"
  | "speed"
  | "wave"
  | "shake"
  | "blink"
  | "instant";

/** Explicit composition root for installed text-performance cue extensions. */
export type TextCueType = CoreTextCueType | MediaTextCueType | RadixTextCueType;
