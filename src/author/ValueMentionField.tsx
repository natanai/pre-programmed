import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type RefObject, type SyntheticEvent } from "react";
import { SEMANTIC_REFERENCE_PROVIDERS } from "../engine/references/catalog";
import {
  makeSemanticReferenceToken,
  semanticReferenceEntries,
  tokenForSemanticReference,
} from "../engine/references/runtime";
import { createEmptyPlayState } from "../engine/project/playState";
import type { PlayState, ProjectSnapshot } from "../engine/project/model";
import { useAuthorResourceTools } from "./resources/context";
import { useAuthorPlayStateOptional } from "./runtime/playStateContext";
import "./valueMentionField.css";

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
  playState,
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
  /** Live context enables selectors such as @current-location. Static references still work without it. */
  playState?: PlayState;
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
  const authorPlayState = useAuthorPlayStateOptional();
  const livePlayState = playState ?? authorPlayState;
  const control = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [selection, setSelection] = useState(0);
  const referenceState = useMemo(
    () => livePlayState ?? createEmptyPlayState(snapshot),
    [livePlayState, snapshot],
  );
  const candidates = useMemo(() => semanticReferenceEntries({ snapshot, state: referenceState })
    .filter((entry) => livePlayState || !entry.candidate.contextual), [snapshot, referenceState, livePlayState]);
  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return candidates
      .filter(({ provider, candidate }) => !query || [
        candidate.key,
        candidate.label,
        candidate.detail ?? "",
        provider.label,
        ...candidate.aliases,
      ].join(" ").toLowerCase().includes(query))
      .sort((left, right) => Number(Boolean(right.candidate.contextual)) - Number(Boolean(left.candidate.contextual))
        || left.provider.label.localeCompare(right.provider.label)
        || left.candidate.label.localeCompare(right.candidate.label))
      .slice(0, 12);
  }, [candidates, mention]);
  const creatableProviders = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) =>
      provider.authorResourceKind
      && resources.canCreate(provider.authorResourceKind)
      && (!query || `${provider.label} ${provider.kind}`.toLowerCase().includes(query)));
  }, [mention, resources]);

  const syncMention = (next: string, cursor: number | null) => {
    setMention(mentionAt(next, cursor ?? next.length));
    setSelection(0);
  };
  const reportSelection = (element: HTMLInputElement | HTMLTextAreaElement) => {
    const start = element.selectionStart ?? 0;
    const end = Math.max(start, element.selectionEnd ?? start);
    onSelectionChange?.({ start, end });
  };
  const insertToken = (token: string) => {
    if (!mention) return;
    const next = `${value.slice(0, mention.start)}${token}${value.slice(mention.end)}`;
    const cursor = mention.start + token.length;
    onValueChange(next);
    setMention(null);
    window.requestAnimationFrame(() => {
      control.current?.focus();
      control.current?.setSelectionRange(cursor, cursor);
      if (control.current) reportSelection(control.current);
    });
  };
  const selectMatch = (match: (typeof matches)[number]) => {
    insertToken(tokenForSemanticReference(match.provider, match.candidate));
  };
  const editMatch = (match: (typeof matches)[number]) => {
    const owner = match.candidate.author;
    if (!owner) return;
    setMention(null);
    resources.edit(owner.resourceKind, owner.resourceId);
  };
  const createFromProvider = (provider: (typeof creatableProviders)[number]) => {
    if (!provider.authorResourceKind) return;
    resources.create(provider.authorResourceKind, (resource) => {
      insertToken(makeSemanticReferenceToken(
        provider.kind,
        resource.id,
        provider.defaultProjection ?? "label",
      ));
    });
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
    {mention ? <div className="value-mention-menu" role="listbox" aria-label="Matching engine references">
      {matches.map((match, index) => <div className="value-mention-option" key={`${match.provider.kind}:${match.candidate.id}`}>
        <button
          type="button"
          className="value-mention-insert"
          role="option"
          aria-selected={index === selection % Math.max(1, matches.length)}
          onPointerDown={(event) => { event.preventDefault(); selectMatch(match); }}
        >
          <span><strong>{match.candidate.label}</strong>{match.candidate.detail ? <small>{match.candidate.detail}</small> : null}</span>
          <span>@{match.candidate.key}</span>
        </button>
        {match.candidate.author && resources.canEdit(match.candidate.author.resourceKind, match.candidate.author.resourceId)
          ? <button
              type="button"
              className="value-mention-edit"
              aria-label={`Edit ${match.candidate.label}`}
              onPointerDown={(event) => { event.preventDefault(); editMatch(match); }}
            >[EDIT]</button>
          : null}
      </div>)}
      {creatableProviders.length ? <div className="value-mention-create-list">
        {creatableProviders.map((provider) => <button
          type="button"
          className="value-mention-create"
          key={provider.kind}
          onPointerDown={(event) => { event.preventDefault(); createFromProvider(provider); }}
        >[+ CREATE {provider.label.toUpperCase()}]</button>)}
      </div> : null}
      {!matches.length && !creatableProviders.length ? <span className="value-mention-empty">NO MATCH</span> : null}
    </div> : null}
  </div>;
}
