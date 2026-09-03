import { MEDIA_INLINE_TEXT_COMMANDS } from "../../features/media/inlineTextCommands";
import type { InlineTextCommandDefinition, ParsedInlineTextCommand } from "./inlineTextCommandTypes";

/** Explicit composition root for feature-owned inline text commands. */
const INLINE_TEXT_COMMANDS: readonly InlineTextCommandDefinition[] = [
  ...MEDIA_INLINE_TEXT_COMMANDS,
];

const COMMANDS_BY_CODE = new Map(INLINE_TEXT_COMMANDS.map((definition) => [definition.code, definition]));

export function inlineTextCommandDefinition(code: string): InlineTextCommandDefinition | undefined {
  return COMMANDS_BY_CODE.get(code.toLowerCase());
}

/** Parse one installed point command beginning exactly at `index`. */
export function inlineTextCommandAt(rawText: string, index: number): ParsedInlineTextCommand | null {
  if (rawText.startsWith("//", index)) return null;
  const match = rawText.slice(index).match(/^\/([a-z][a-z0-9-]*)\{/i);
  if (!match) return null;
  const definition = inlineTextCommandDefinition(match[1]);
  if (!definition) return null;
  const valueStart = index + match[0].length;
  const close = rawText.indexOf("}", valueStart);
  const closed = close >= 0;
  const valueEnd = closed ? close : rawText.length;
  return {
    definition,
    rawStart: index,
    rawEnd: closed ? close + 1 : rawText.length,
    valueStart,
    valueEnd,
    value: rawText.slice(valueStart, valueEnd),
    closed,
  };
}

/** Complete feature commands currently present in authored source text. */
export function scanInlineTextCommands(rawText: string): ParsedInlineTextCommand[] {
  const commands: ParsedInlineTextCommand[] = [];
  let index = 0;
  while (index < rawText.length) {
    if (rawText.startsWith("//", index)) {
      index += 2;
      continue;
    }
    const command = inlineTextCommandAt(rawText, index);
    if (command?.closed) {
      commands.push(command);
      index = command.rawEnd;
      continue;
    }
    index += 1;
  }
  return commands;
}
