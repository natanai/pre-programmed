import type { InlineTextCommandDefinition } from "../../engine/presentation/inlineTextCommandTypes";

export const RADIX_INLINE_TEXT_COMMANDS: readonly InlineTextCommandDefinition[] = [
  { code: "radix", cueType: "radix", valueRequired: true },
];
