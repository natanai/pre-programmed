import type { InlineTextCommandDefinition } from "../../engine/presentation/inlineTextCommandTypes";

/** Media-owned slash commands. Narrative only sees the shared command contract. */
export const MEDIA_INLINE_TEXT_COMMANDS: readonly InlineTextCommandDefinition[] = [
  { code: "synth", cueType: "synth", valueRequired: true },
  { code: "audio", cueType: "audio", valueRequired: true },
  { code: "sprite", cueType: "sprite", valueRequired: true },
];
