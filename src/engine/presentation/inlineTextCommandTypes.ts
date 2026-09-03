import type { TextCueType } from "./textCueTypes";

/**
 * Runtime meaning for a slash command embedded directly in authored prose.
 * Feature modules own these definitions; the presentation composition root
 * only installs them.
 */
export type InlineTextCommandDefinition = {
  code: string;
  cueType: TextCueType;
  valueRequired?: boolean;
};

export type ParsedInlineTextCommand = {
  definition: InlineTextCommandDefinition;
  rawStart: number;
  rawEnd: number;
  valueStart: number;
  valueEnd: number;
  value: string;
  closed: boolean;
};
