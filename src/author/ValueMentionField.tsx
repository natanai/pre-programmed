import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type RefObject, type SyntheticEvent } from "react";
import { makeValueToken } from "../features/narrative/interpolation";
import type { ProjectSnapshot } from "../engine/project/model";
import { useAuthorResourceTools } from "./resources/context";

type Mention = { start: number; end: number; query: string };
type TextSelection = { start: number; end: number };

function mentionAt(value: string, cursor: number): Mention | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|[\s([{])@([a-z0-9_-]*)$/i);
  if (!match) return null;
  const query = match[1];
  return { start: cursor - query.length - 1, end: cursor, query };
}

export function ValueMentionField({
  snapshot,
  value,
  onValueChange,
  multiline = false,
  rows = 2,
  placeholder,
  ariaLabel,
  autoFocus,
  textareaRef,
  onKeyDown,
  onSelectionChange,
}: {
  snapshot: ProjectSnapshot;
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectionChange?: (selection: TextSelection) => void;
}) {
  const resources = useAuthorResourceTools();
  const control = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [selection, setSelection] = useState(0);
  const candidates = useMemo(() => [
    ...snapshot.variables.map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      kind: "variable" as const,
      token: makeValueToken("variable", item.key),
    })),
    ...snapshot.computedValues.map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      kind: "computed" as const,
      token: makeValueToken("computed", item.key, item.format),
    })),
  ], [snapshot.variables, snapshot.computedValues]);
  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return candidates
      .filter((item) => !query || `${item.key} ${item.label}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [candidates, mention]);

  const syncMention = (next: string, cursor: number | null) => {
    setMention(mentionAt(next, cursor ?? next.length));
    setSelection(0);
  };
  const reportSelection = (element: HTMLInputElement | HTMLTextAreaElement) => {
    const start = element.selectionStart ?? 0;
    const end = Math.max(start, element.selectionEnd ?? start);
    onSelectionChange?.({ start, end });
  };
  const selectMatch = (match: (typeof matches)[number]) => {
    if (!mention) return;
    const next = `${value.slice(0, mention.start)}${match.token}${value.slice(mention.end)}`;
    const cursor = mention.start + match.token.length;
    onValueChange(next);
    setMention(null);
    window.requestAnimationFrame(() => {
      control.current?.focus();
      control.current?.setSelectionRange(cursor, cursor);
      if (control.current) reportSelection(control.current);
    });
  };
  const editMatch = (match: (typeof matches)[number]) => {
    setMention(null);
    resources.edit(match.kind, match.id);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (mention && matches.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelection((current) => (current + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectMatch(matches[selection % matches.length]);
        return;
      }
    }
    if (mention && event.key === "Escape") {
      event.preventDefault();
      setMention(null);
      return;
    }
    onKeyDown?.(event);
  };
  const handleSelect = (event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => reportSelection(event.currentTarget);
  const common = {
    value,
    placeholder,
    "aria-label": ariaLabel,
    autoFocus,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onValueChange(event.target.value);
      syncMention(event.target.value, event.target.selectionStart);
      reportSelection(event.target);
    },
    onClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      syncMention(value, event.currentTarget.selectionStart);
      reportSelection(event.currentTarget);
    },
    onSelect: handleSelect,
    onKeyUp: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) syncMention(event.currentTarget.value, event.currentTarget.selectionStart);
      reportSelection(event.currentTarget);
    },
    onKeyDown: handleKeyDown,
  };

  return <div className="value-mention-field">
    {multiline
      ? <textarea {...common} rows={rows} ref={(element) => { control.current = element; if (textareaRef) textareaRef.current = element; }} />
      : <input {...common} ref={(element) => { control.current = element; }} />}
    {mention ? <div className="value-mention-menu" role="listbox" aria-label="Matching values">
      {matches.length ? matches.map((match, index) => <div className="value-mention-option" key={`${match.kind}:${match.id}`}>
        <button
          type="button"
          className="value-mention-insert"
          role="option"
          aria-selected={index === selection % matches.length}
          onPointerDown={(event) => { event.preventDefault(); selectMatch(match); }}
        ><span>{match.label}</span><span>@{match.key}</span></button>
        <button
          type="button"
          className="value-mention-edit"
          aria-label={`Edit ${match.label}`}
          onPointerDown={(event) => { event.preventDefault(); editMatch(match); }}
        >[EDIT]</button>
      </div>) : <span>NO MATCH</span>}
    </div> : null}
  </div>;
}
