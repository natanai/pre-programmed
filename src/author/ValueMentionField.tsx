import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
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
type MenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

function mentionAt(value: string, cursor: number): Mention | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|[\s([{])@([a-z0-9_-]*)$/i);
  if (!match) return null;
  const query = match[1];
  return { start: cursor - query.length - 1, end: cursor, query };
}

function searchableReferenceText(entry: ReturnType<typeof semanticReferenceEntries>[number]) {
  return [
    entry.candidate.key,
    entry.candidate.label,
    entry.candidate.detail ?? "",
    entry.provider.label,
    entry.provider.kind,
    ...entry.candidate.aliases,
    ...Object.values(entry.candidate.projections)
      .filter((value): value is string | number | boolean => ["string", "number", "boolean"].includes(typeof value))
      .map(String),
  ].join(" ").toLowerCase();
}

function referenceMatchScore(entry: ReturnType<typeof semanticReferenceEntries>[number], query: string) {
  if (!query) return entry.candidate.contextual ? 0 : 10;
  const label = entry.candidate.label.toLowerCase();
  const key = entry.candidate.key.toLowerCase();
  const aliases = entry.candidate.aliases.map((alias) => alias.toLowerCase());
  const provider = `${entry.provider.label} ${entry.provider.kind}`.toLowerCase();
  if (label === query || key === query || aliases.includes(query)) return entry.candidate.contextual ? 0 : 1;
  if (label.startsWith(query) || key.startsWith(query)) return entry.candidate.contextual ? 2 : 3;
  if (aliases.some((alias) => alias.startsWith(query))) return entry.candidate.contextual ? 4 : 5;
  if (provider.startsWith(query)) return 6;
  return searchableReferenceText(entry).includes(query) ? 7 : Number.POSITIVE_INFINITY;
}

function createLabel(kind: string) {
  return kind.replaceAll("-", " ").toUpperCase();
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
  const menu = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const referenceState = useMemo(
    () => livePlayState ?? createEmptyPlayState(snapshot),
    [livePlayState, snapshot],
  );
  const candidates = useMemo(() => semanticReferenceEntries({ snapshot, state: referenceState })
    .filter((entry) => livePlayState || !entry.candidate.contextual), [snapshot, referenceState, livePlayState]);
  const matches = useMemo(() => {
    if (!mention) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return candidates
      .map((entry) => ({ entry, score: referenceMatchScore(entry, normalizedQuery) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((left, right) => left.score - right.score
        || left.entry.provider.label.localeCompare(right.entry.provider.label)
        || left.entry.candidate.label.localeCompare(right.entry.candidate.label))
      .map(({ entry }) => entry);
  }, [candidates, mention, query]);
  const groups = useMemo(() => {
    if (!mention) return [];
    const result: Array<{
      id: string;
      label: string;
      entries: typeof matches;
    }> = [];
    const live = matches.filter(({ candidate }) => candidate.contextual);
    if (live.length) result.push({ id: "live", label: "LIVE", entries: live });
    for (const provider of SEMANTIC_REFERENCE_PROVIDERS) {
      const entries = matches.filter((entry) => !entry.candidate.contextual && entry.provider.kind === provider.kind);
      if (entries.length) result.push({ id: provider.kind, label: provider.label.toUpperCase(), entries });
    }
    return result;
  }, [matches, mention]);
  const creatableProviders = useMemo(() => {
    if (!mention) return [];
    const unique = new Map<string, (typeof SEMANTIC_REFERENCE_PROVIDERS)[number]>();
    for (const provider of SEMANTIC_REFERENCE_PROVIDERS) {
      if (!provider.authorResourceKind || !resources.canCreate(provider.authorResourceKind)) continue;
      if (!unique.has(provider.authorResourceKind)) unique.set(provider.authorResourceKind, provider);
    }
    const all = [...unique.values()];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return all;
    const filtered = all.filter((provider) => `${provider.label} ${provider.kind} ${provider.authorResourceKind}`.toLowerCase().includes(normalizedQuery));
    return filtered.length || matches.length ? filtered : all;
  }, [mention, query, resources, matches.length]);

  const updateMenuPosition = () => {
    const element = control.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(560, Math.max(300, viewportWidth - margin * 2));
    const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
    const below = viewportHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const useAbove = below < 260 && above > below;
    if (useAbove) {
      setMenuPosition({
        left,
        width,
        bottom: Math.max(margin, viewportHeight - rect.top + 6),
        maxHeight: Math.max(220, Math.min(480, above - 6)),
      });
      return;
    }
    setMenuPosition({
      left,
      width,
      top: Math.max(margin, rect.bottom + 6),
      maxHeight: Math.max(220, Math.min(480, below - 6)),
    });
  };

  const reportSelection = (element: HTMLInputElement | HTMLTextAreaElement) => {
    const start = element.selectionStart ?? 0;
    const end = Math.max(start, element.selectionEnd ?? start);
    onSelectionChange?.({ start, end });
  };
  const closePicker = (restoreFocus = false) => {
    const target = mention;
    setMention(null);
    setQuery("");
    setSelection(0);
    setMenuPosition(null);
    if (!restoreFocus || !target) return;
    window.requestAnimationFrame(() => {
      control.current?.focus({ preventScroll: true });
      control.current?.setSelectionRange(target.end, target.end);
      if (control.current) reportSelection(control.current);
    });
  };
  const syncMention = (next: string, cursor: number | null) => {
    const nextMention = mentionAt(next, cursor ?? next.length);
    setMention(nextMention);
    setQuery(nextMention?.query ?? "");
    setSelection(0);
  };
  const insertTokenAt = (token: string, targetMention: Mention | null = mention) => {
    if (!targetMention) return;
    const next = `${value.slice(0, targetMention.start)}${token}${value.slice(targetMention.end)}`;
    const cursor = targetMention.start + token.length;
    onValueChange(next);
    setMention(null);
    setQuery("");
    setSelection(0);
    setMenuPosition(null);
    window.requestAnimationFrame(() => {
      control.current?.focus({ preventScroll: true });
      control.current?.setSelectionRange(cursor, cursor);
      if (control.current) reportSelection(control.current);
    });
  };
  const selectMatch = (match: (typeof matches)[number]) => {
    insertTokenAt(tokenForSemanticReference(match.provider, match.candidate));
  };
  const editMatch = (match: (typeof matches)[number]) => {
    const owner = match.candidate.author;
    if (!owner) return;
    closePicker(false);
    resources.edit(owner.resourceKind, owner.resourceId);
  };
  const createFromProvider = (provider: (typeof creatableProviders)[number]) => {
    if (!provider.authorResourceKind || !mention) return;
    const targetMention = mention;
    closePicker(false);
    resources.create(provider.authorResourceKind, (resource) => {
      insertTokenAt(makeSemanticReferenceToken(
        provider.kind,
        resource.id,
        provider.defaultProjection ?? "label",
      ), targetMention);
    });
  };

  useEffect(() => {
    if (!mention) return;
    updateMenuPosition();
    const frame = window.requestAnimationFrame(() => search.current?.focus({ preventScroll: true }));
    const reposition = () => updateMenuPosition();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menu.current?.contains(target) || control.current?.contains(target))) return;
      closePicker(false);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [mention?.start, mention?.end]);

  useEffect(() => {
    setSelection(0);
  }, [query]);

  useEffect(() => {
    if (!mention || !matches.length) return;
    const selected = menu.current?.querySelector<HTMLElement>(`[data-reference-index="${selection % matches.length}"]`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [mention, matches.length, selection]);

  const moveSelection = (direction: 1 | -1) => {
    if (!matches.length) return;
    setSelection((current) => (current + direction + matches.length) % matches.length);
  };
  const handlePickerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker(true);
      return;
    }
    if (!matches.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectMatch(matches[selection % matches.length]);
    }
  };
  const handleTextKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (mention && event.key === "Escape") {
      event.preventDefault();
      closePicker(false);
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
      if (event.key !== "Escape") syncMention(event.currentTarget.value, event.currentTarget.selectionStart);
      reportSelection(event.currentTarget);
    },
    onKeyDown: handleTextKeyDown,
  };

  let optionIndex = -1;
  const picker = mention && menuPosition ? <div
    ref={menu}
    className="value-mention-menu"
    role="dialog"
    aria-label="Reference picker"
    style={{
      left: menuPosition.left,
      width: menuPosition.width,
      top: menuPosition.top,
      bottom: menuPosition.bottom,
      maxHeight: menuPosition.maxHeight,
    } satisfies CSSProperties}
  >
    <div className="value-mention-header">
      <div className="value-mention-title-row">
        <strong>REFERENCES</strong>
        <button type="button" className="value-mention-close" aria-label="Close reference picker" onClick={() => closePicker(true)}>[X]</button>
      </div>
      <input
        ref={search}
        className="value-mention-search"
        type="search"
        value={query}
        placeholder="Search references..."
        aria-label="Search references"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handlePickerKeyDown}
      />
    </div>
    <div className="value-mention-results" role="listbox" aria-label="Matching engine references">
      {groups.map((group) => <section className="value-mention-group" key={group.id}>
        <div className="value-mention-group-label">{group.label}</div>
        {group.entries.map((match) => {
          optionIndex += 1;
          const index = optionIndex;
          const editable = Boolean(match.candidate.author
            && resources.canEdit(match.candidate.author.resourceKind, match.candidate.author.resourceId));
          const meta = [match.candidate.detail, `@${match.candidate.key}`].filter(Boolean).join(" · ");
          return <div className="value-mention-option" key={`${match.provider.kind}:${match.candidate.id}`} data-reference-index={index}>
            <button
              type="button"
              className="value-mention-insert"
              role="option"
              aria-selected={index === selection % Math.max(1, matches.length)}
              onClick={() => selectMatch(match)}
            >
              <span className="value-mention-option-copy">
                <strong>{match.candidate.label}</strong>
                <small>{meta}</small>
              </span>
              <span className="value-mention-type">{match.provider.label}</span>
            </button>
            {editable ? <button
              type="button"
              className="value-mention-edit"
              aria-label={`Edit ${match.candidate.label}`}
              onClick={() => editMatch(match)}
            >[EDIT]</button> : null}
          </div>;
        })}
      </section>)}
      {!matches.length ? <div className="value-mention-empty">NO MATCHING REFERENCE.</div> : null}
      {creatableProviders.length ? <section className="value-mention-group value-mention-create-group">
        <div className="value-mention-group-label">CREATE</div>
        <div className="value-mention-create-list">
          {creatableProviders.map((provider) => <button
            type="button"
            className="value-mention-create"
            key={provider.authorResourceKind ?? provider.kind}
            onClick={() => createFromProvider(provider)}
          >[+ {createLabel(provider.authorResourceKind ?? provider.label)}]</button>)}
        </div>
      </section> : null}
    </div>
  </div> : null;

  return <div className="value-mention-field">
    {multiline
      ? <textarea {...common} rows={rows} ref={(element) => { control.current = element; if (textareaRef) textareaRef.current = element; }} />
      : <input {...common} ref={(element) => { control.current = element; }} />}
    {picker ? createPortal(picker, document.body) : null}
  </div>;
}
