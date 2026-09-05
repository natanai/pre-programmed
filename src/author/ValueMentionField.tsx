import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type SyntheticEvent,
} from "react";
import {
  authorSemanticReferenceView,
  authorSyntaxForSemanticReference,
  storeAuthorSemanticReferences,
} from "../engine/references/authorSyntax";
import { SEMANTIC_REFERENCE_PROVIDERS } from "../engine/references/catalog";
import {
  makeSemanticReferenceToken,
  semanticReferenceEntries,
} from "../engine/references/runtime";
import { createEmptyPlayState } from "../engine/project/playState";
import type { PlayState, ProjectSnapshot } from "../engine/project/model";
import { AuthorPicker, type AuthorPickerAction, type AuthorPickerGroup } from "./picker/AuthorPicker";
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

function searchableReferenceText(entry: ReturnType<typeof semanticReferenceEntries>[number]) {
  return [
    entry.candidate.key,
    entry.candidate.label,
    entry.candidate.detail ?? "",
    entry.provider.label,
    entry.provider.kind,
    entry.provider.authorSyntax ?? "",
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
  const provider = `${entry.provider.label} ${entry.provider.kind} ${entry.provider.authorSyntax ?? ""}`.toLowerCase();
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
  /** Live context enables selectors such as current-location. Static references still work without it. */
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
  const [query, setQuery] = useState("");

  const referenceState = useMemo(
    () => livePlayState ?? createEmptyPlayState(snapshot),
    [livePlayState, snapshot],
  );
  const referenceContext = useMemo(
    () => ({ snapshot, state: referenceState }),
    [snapshot, referenceState],
  );
  const authorView = useMemo(
    () => authorSemanticReferenceView(value, referenceContext),
    [value, referenceContext],
  );
  const candidates = useMemo(() => semanticReferenceEntries(referenceContext)
    .filter((entry) => livePlayState || !entry.candidate.contextual), [referenceContext, livePlayState]);
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

  const reportSelection = useCallback((element: HTMLInputElement | HTMLTextAreaElement, view = authorView) => {
    const start = element.selectionStart ?? 0;
    const end = Math.max(start, element.selectionEnd ?? start);
    onSelectionChange?.({
      start: view.toStoredIndex(start),
      end: view.toStoredIndex(end),
    });
  }, [authorView, onSelectionChange]);

  const closePicker = useCallback(() => {
    setMention(null);
    setQuery("");
  }, []);

  const syncMention = (next: string, cursor: number | null) => {
    const nextMention = mentionAt(next, cursor ?? next.length);
    setMention(nextMention);
    setQuery(nextMention?.query ?? "");
  };

  const applyDisplayValue = (displayValue: string, cursor: number, keepPicker = false) => {
    const stored = storeAuthorSemanticReferences(displayValue, referenceContext);
    const nextView = authorSemanticReferenceView(stored, referenceContext);
    onValueChange(stored);
    if (!keepPicker) closePicker();
    window.requestAnimationFrame(() => {
      control.current?.focus({ preventScroll: true });
      const nextCursor = Math.min(cursor, nextView.text.length);
      control.current?.setSelectionRange(nextCursor, nextCursor);
      if (control.current) reportSelection(control.current, nextView);
    });
  };

  const insertMatch = (match: (typeof matches)[number]) => {
    if (!mention) return;
    const syntax = authorSyntaxForSemanticReference(match.provider, match.candidate);
    const nextDisplay = `${authorView.text.slice(0, mention.start)}${syntax}${authorView.text.slice(mention.end)}`;
    applyDisplayValue(nextDisplay, mention.start + syntax.length);
  };

  const editMatch = (match: (typeof matches)[number]) => {
    const owner = match.candidate.author;
    if (!owner) return;
    closePicker();
    resources.edit(owner.resourceKind, owner.resourceId);
  };

  const createFromProvider = (provider: (typeof SEMANTIC_REFERENCE_PROVIDERS)[number]) => {
    if (!provider.authorResourceKind || !mention) return;
    const target = {
      start: authorView.toStoredIndex(mention.start),
      end: authorView.toStoredIndex(mention.end),
    };
    const baseline = value;
    closePicker();
    resources.create(provider.authorResourceKind, (resource) => {
      const token = makeSemanticReferenceToken(
        provider.kind,
        resource.id,
        provider.defaultProjection ?? "label",
      );
      const next = `${baseline.slice(0, target.start)}${token}${baseline.slice(target.end)}`;
      onValueChange(next);
    });
  };

  const pickerGroups = useMemo<AuthorPickerGroup[]>(() => {
    if (!mention) return [];
    const groups: AuthorPickerGroup[] = [];
    const itemFor = (match: (typeof matches)[number]) => {
      const owner = match.candidate.author;
      const editable = Boolean(owner && resources.canEdit(owner.resourceKind, owner.resourceId));
      const syntax = authorSyntaxForSemanticReference(match.provider, match.candidate);
      return {
        id: `${match.provider.kind}:${match.candidate.id}`,
        label: match.candidate.label,
        detail: [match.candidate.detail, syntax].filter(Boolean).join(" · "),
        meta: match.provider.label,
        onSelect: () => insertMatch(match),
        ...(editable && owner ? {
          secondary: {
            label: "[EDIT]",
            ariaLabel: `Edit ${match.candidate.label}`,
            onSelect: () => editMatch(match),
          },
        } : {}),
      };
    };
    const live = matches.filter(({ candidate }) => candidate.contextual);
    if (live.length) groups.push({ id: "live", label: "LIVE", items: live.map(itemFor) });
    for (const provider of SEMANTIC_REFERENCE_PROVIDERS) {
      const entries = matches.filter((entry) => !entry.candidate.contextual && entry.provider.kind === provider.kind);
      if (entries.length) groups.push({ id: provider.kind, label: provider.label.toUpperCase(), items: entries.map(itemFor) });
    }
    return groups;
  }, [mention, matches, resources, authorView.text]);

  const pickerActions = useMemo<AuthorPickerAction[]>(() => {
    if (!mention) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const unique = new Map<string, (typeof SEMANTIC_REFERENCE_PROVIDERS)[number]>();
    for (const provider of SEMANTIC_REFERENCE_PROVIDERS) {
      if (!provider.authorResourceKind || !resources.canCreate(provider.authorResourceKind)) continue;
      if (!unique.has(provider.authorResourceKind)) unique.set(provider.authorResourceKind, provider);
    }
    const all = [...unique.values()];
    const matching = normalizedQuery
      ? all.filter((provider) => `${provider.label} ${provider.kind} ${provider.authorSyntax ?? ""} ${provider.authorResourceKind}`.toLowerCase().includes(normalizedQuery))
      : all;
    const visible = matching.length || matches.length ? matching : all;
    return visible.map((provider) => ({
      id: provider.kind,
      label: `[+ ${createLabel(provider.authorResourceKind!)}]`,
      onSelect: () => createFromProvider(provider),
    }));
  }, [mention, query, resources, matches.length, authorView.text, value]);

  const handleTextKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (mention && event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }
    onKeyDown?.(event);
  };
  const handleSelect = (event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => reportSelection(event.currentTarget);
  const common = {
    value: authorView.text,
    placeholder,
    "aria-label": ariaLabel,
    autoFocus,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const displayValue = event.target.value;
      const cursor = event.target.selectionStart ?? displayValue.length;
      const stored = storeAuthorSemanticReferences(displayValue, referenceContext);
      const nextView = authorSemanticReferenceView(stored, referenceContext);
      onValueChange(stored);
      syncMention(displayValue, cursor);
      reportSelection(event.target, nextView);
    },
    onClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      syncMention(event.currentTarget.value, event.currentTarget.selectionStart);
      reportSelection(event.currentTarget);
    },
    onSelect: handleSelect,
    onKeyUp: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key !== "Escape") syncMention(event.currentTarget.value, event.currentTarget.selectionStart);
      reportSelection(event.currentTarget);
    },
    onKeyDown: handleTextKeyDown,
  };

  return <div className="value-mention-field">
    {multiline
      ? <textarea {...common} rows={rows} ref={(element) => { control.current = element; if (textareaRef) textareaRef.current = element; }} />
      : <input {...common} ref={(element) => { control.current = element; }} />}
    <AuthorPicker
      open={Boolean(mention)}
      title="REFERENCES"
      query={query}
      onQueryChange={setQuery}
      groups={pickerGroups}
      actions={pickerActions}
      placeholder="Search references..."
      emptyText="NO MATCH"
      onClose={closePicker}
      anchorRef={control as RefObject<HTMLElement | null>}
    />
  </div>;
}
