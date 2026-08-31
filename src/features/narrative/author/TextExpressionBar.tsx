import type { RefObject } from "react";
import "./textExpressionBar.css";

export type TextSelection = { start: number; end: number };

type ScopedExpression = "slow" | "fast" | "shout" | "hit" | "wave" | "blink" | "instant";
type TextExpression = ScopedExpression | "pause";

const expressions: Array<{ type: TextExpression; label: string; help: string }> = [
  { type: "pause", label: "PAUSE", help: "Pause at the cursor or after the selected text." },
  { type: "slow", label: "SLOW", help: "Slow the selected word or phrase." },
  { type: "fast", label: "FAST", help: "Speed up the selected word or phrase." },
  { type: "shout", label: "SHOUT", help: "Punch up the selection with speed and shake." },
  { type: "hit", label: "HIT", help: "Reveal the selection instantly with impact." },
  { type: "wave", label: "WAVE", help: "Give the selected text a wave motion." },
  { type: "blink", label: "BLINK", help: "Blink the selected text." },
  { type: "instant", label: "INSTANT", help: "Reveal the selected text immediately." },
];

const scopeCode: Record<ScopedExpression, string> = {
  slow: "l",
  fast: "f",
  shout: "s",
  hit: "h",
  wave: "w",
  blink: "b",
  instant: "i",
};

function wordRange(value: string, cursor: number): TextSelection {
  if (!value.length) return { start: cursor, end: cursor };
  const isWord = (character: string) => /[\p{L}\p{N}'’-]/u.test(character);
  let start = Math.max(0, Math.min(value.length, cursor));
  let end = start;
  if (start === value.length || !isWord(value[start] ?? "")) {
    if (start > 0 && isWord(value[start - 1] ?? "")) start -= 1;
    else return { start: cursor, end: cursor };
  }
  end = start + 1;
  while (start > 0 && isWord(value[start - 1])) start -= 1;
  while (end < value.length && isWord(value[end])) end += 1;
  return { start, end };
}

export function applyTextExpression(value: string, selection: TextSelection, expression: TextExpression) {
  const clamped = {
    start: Math.max(0, Math.min(value.length, selection.start)),
    end: Math.max(0, Math.min(value.length, Math.max(selection.start, selection.end))),
  };

  if (expression === "pause") {
    const position = clamped.end;
    const inserted = "/p";
    return {
      value: `${value.slice(0, position)}${inserted}${value.slice(position)}`,
      selection: { start: position + inserted.length, end: position + inserted.length },
    };
  }

  const target = clamped.end > clamped.start ? clamped : wordRange(value, clamped.start);
  if (target.end <= target.start) return { value, selection: clamped };
  const prefix = `/${scopeCode[expression]}{`;
  const suffix = "}";
  return {
    value: `${value.slice(0, target.start)}${prefix}${value.slice(target.start, target.end)}${suffix}${value.slice(target.end)}`,
    selection: {
      start: target.start + prefix.length,
      end: target.end + prefix.length,
    },
  };
}

export function TextExpressionBar({ value, selection, textareaRef, onChange }: {
  value: string;
  selection: TextSelection;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string, selection: TextSelection) => void;
}) {
  const apply = (type: TextExpression) => {
    const result = applyTextExpression(value, selection, type);
    onChange(result.value, result.selection);
    window.requestAnimationFrame(() => {
      const field = textareaRef?.current;
      if (!field) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(result.selection.start, result.selection.end);
    });
  };

  return <div className="text-expression-bar" aria-label="Text expression">
    <div className="text-expression-heading">
      <span>TEXT EXPRESSION</span>
      <small>{selection.end > selection.start ? "selected text" : "word at cursor"}</small>
    </div>
    <div className="text-expression-actions">
      {expressions.map((item) => <button
        type="button"
        key={item.type}
        title={item.help}
        aria-label={`${item.label}: ${item.help}`}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => apply(item.type)}
      >[{item.label}]</button>)}
    </div>
  </div>;
}
