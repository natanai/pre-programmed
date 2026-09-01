export type TextSelection = { start: number; end: number };

export type TextExpression =
  | "slow"
  | "fast"
  | "shout"
  | "hit"
  | "wave"
  | "blink"
  | "instant"
  | "pause";

const SCOPE_CODE: Readonly<Record<Exclude<TextExpression, "pause">, string>> = {
  slow: "l",
  fast: "f",
  shout: "s",
  hit: "h",
  wave: "w",
  blink: "b",
  instant: "i",
};

function clampSelection(value: string, selection: TextSelection): TextSelection {
  const start = Math.max(0, Math.min(value.length, selection.start));
  const end = Math.max(start, Math.min(value.length, selection.end));
  return { start, end };
}

function wordSelection(value: string, caret: number): TextSelection {
  if (!value.length) return { start: caret, end: caret };

  let start = Math.max(0, Math.min(value.length, caret));
  let end = start;

  while (start > 0 && !/\s/.test(value[start - 1])) start -= 1;
  while (end < value.length && !/\s/.test(value[end])) end += 1;

  return { start, end };
}

/**
 * Apply Narrative's terse inline text notation without changing the selected
 * prose. This is a pure authoring helper; playback meaning remains owned by
 * `compileTextNotation`.
 */
export function applyTextExpression(
  value: string,
  rawSelection: TextSelection,
  expression: TextExpression,
): { value: string; selection: TextSelection } {
  const selection = clampSelection(value, rawSelection);

  if (expression === "pause") {
    const at = selection.end;
    return {
      value: `${value.slice(0, at)}/p${value.slice(at)}`,
      selection: { start: at + 2, end: at + 2 },
    };
  }

  const target = selection.start === selection.end
    ? wordSelection(value, selection.start)
    : selection;
  const code = SCOPE_CODE[expression];
  const prefix = `/${code}{`;

  return {
    value: `${value.slice(0, target.start)}${prefix}${value.slice(target.start, target.end)}}${value.slice(target.end)}`,
    selection: {
      start: target.start + prefix.length,
      end: target.end + prefix.length,
    },
  };
}
