import { useMemo, useRef, useState } from "react";
import { ValueMentionField } from "../../../author/ValueMentionField";
import {
  featureTextCueAuthorAdapterForCode,
  featureTextCueAuthorAdapters,
} from "../../../author/textCues/catalog";
import { authorSemanticReferenceView } from "../../../engine/references/authorSyntax";
import { scanInlineTextCommands } from "../../../engine/presentation/inlineTextCommandCatalog";
import { createEmptyPlayState } from "../../../engine/project/playState";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import type { TextPerformance } from "../model";
import { validateTextNotation } from "../textNotation";
import { TextRulesReference, type InlineTextRule } from "./TextRulesReference";
import "./authoredTextEditor.css";

export type AuthoredTextValue = {
  text: string;
  performance: TextPerformance;
};

export function AuthoredTextEditor({
  value,
  snapshot,
  playState,
  label,
  rows = 6,
  autoFocus = false,
  onChange,
  onPreview,
}: {
  value: AuthoredTextValue;
  snapshot: ProjectSnapshot;
  playState?: PlayState;
  label: string;
  rows?: number;
  autoFocus?: boolean;
  onChange: (value: AuthoredTextValue) => void;
  onPreview?: (value: AuthoredTextValue) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const referenceState = useMemo(() => playState ?? createEmptyPlayState(snapshot), [playState, snapshot]);
  const referenceContext = useMemo(() => ({ snapshot, state: referenceState }), [snapshot, referenceState]);
  const issues = useMemo(() => validateTextNotation(value.text), [value.text]);
  const featureCommands = featureTextCueAuthorAdapters();
  const configuredCommands = scanInlineTextCommands(value.text)
    .map((command) => ({ command, adapter: featureTextCueAuthorAdapterForCode(command.definition.code) }))
    .filter((entry) => Boolean(entry.adapter?.renderValue));

  const emit = (next: AuthoredTextValue) => onChange({
    ...next,
    performance: { ...next.performance, cues: [] },
  });

  const displaySelection = (text: string, start: number, end = start) => {
    const view = authorSemanticReferenceView(text, referenceContext);
    return {
      start: view.toDisplayIndex(start),
      end: view.toDisplayIndex(end),
    };
  };

  const focusSelection = (text: string, start: number, end = start) => window.requestAnimationFrame(() => {
    const display = displaySelection(text, start, end);
    textarea.current?.focus();
    textarea.current?.setSelectionRange(display.start, display.end);
    setSelection({ start, end });
  });

  const preserveSelectionWithoutFocus = (text: string, start: number, end = start) => window.requestAnimationFrame(() => {
    const display = displaySelection(text, start, end);
    textarea.current?.setSelectionRange(display.start, display.end);
    setSelection({ start, end });
  });

  const applyInlineRule = (rule: InlineTextRule) => {
    const selected = value.text.slice(selection.start, selection.end);
    const prefix = rule === "shake"
      ? "/shake{"
      : rule === "speed"
        ? "/speed30{"
        : !["pause", "literal-slash"].includes(rule)
          ? `/${rule}{`
          : "";
    const insertion = rule === "pause"
      ? "/p"
      : rule === "literal-slash"
        ? "//"
        : `${prefix}${selected || "text"}}`;
    const nextText = `${value.text.slice(0, selection.start)}${insertion}${value.text.slice(selection.end)}`;
    emit({ ...value, text: nextText });
    if (!selected && prefix) {
      const start = selection.start + prefix.length;
      focusSelection(nextText, start, start + 4);
    } else {
      focusSelection(nextText, selection.start + insertion.length);
    }
  };

  const applyFeatureCommand = (code: string) => {
    const insertion = `/${code}{}`;
    const at = selection.end;
    const nextText = `${value.text.slice(0, at)}${insertion}${value.text.slice(at)}`;
    emit({ ...value, text: nextText });
    const insideBraces = at + code.length + 2;
    preserveSelectionWithoutFocus(nextText, insideBraces);
  };

  const updateCommandValue = (rawEnd: number, valueStart: number, valueEnd: number, nextValue: string) => {
    const safeValue = nextValue.replaceAll("}", "");
    const nextText = `${value.text.slice(0, valueStart)}${safeValue}${value.text.slice(valueEnd)}`;
    emit({ ...value, text: nextText });
    const nextCommandEnd = rawEnd + safeValue.length - (valueEnd - valueStart);
    preserveSelectionWithoutFocus(nextText, nextCommandEnd);
  };

  const removeCommand = (rawStart: number, rawEnd: number) => {
    const nextText = `${value.text.slice(0, rawStart)}${value.text.slice(rawEnd)}`;
    emit({ ...value, text: nextText });
    preserveSelectionWithoutFocus(nextText, rawStart);
  };

  return <div className="authored-text-editor">
    <div className="authored-text-heading">
      <span>{label}</span>
      <label className="authored-text-speed">
        <span>SPEED</span>
        <input
          type="number"
          min={1}
          max={120}
          value={value.performance.charactersPerSecond}
          aria-label={`${label} speed in characters per second`}
          onChange={(event) => emit({
            ...value,
            performance: { ...value.performance, charactersPerSecond: Math.max(1, Math.min(120, Number(event.target.value) || 1)) },
          })}
        />
        <span>cps</span>
      </label>
    </div>
    <label className="authored-text-field">
      <ValueMentionField
        snapshot={snapshot}
        playState={playState}
        multiline
        rows={rows}
        textareaRef={textarea}
        value={value.text}
        onValueChange={(text) => emit({ ...value, text })}
        onSelectionChange={setSelection}
        autoFocus={autoFocus}
        ariaLabel={label}
      />
    </label>
    <div className="authored-text-tools">
      <span className="authored-text-count">{value.text.length} char{value.text.length === 1 ? "" : "s"}</span>
      <TextRulesReference
        onApply={applyInlineRule}
        featureCommands={featureCommands.map((adapter) => ({
          code: adapter.inlineCode,
          label: adapter.label,
          category: adapter.category,
          description: adapter.description,
        }))}
        onApplyFeatureCommand={applyFeatureCommand}
      />
      {onPreview ? <button type="button" className="authored-text-preview" disabled={Boolean(issues.length)} onClick={() => onPreview({
        ...value,
        performance: { ...value.performance, cues: [] },
      })}>[PREVIEW]</button> : null}
    </div>
    {configuredCommands.length ? <section className="inline-command-configs" aria-label="Inline command details">
      <strong>COMMAND DETAILS</strong>
      {configuredCommands.map(({ command, adapter }, index) => adapter ? <div
        className="inline-command-config-row"
        key={`${command.definition.code}:${command.rawStart}`}
      >
        <div className="inline-command-config-heading">
          <span><strong>{index + 1}. /{command.definition.code}</strong><small>{adapter.description}</small></span>
          <button type="button" onClick={() => removeCommand(command.rawStart, command.rawEnd)}>[REMOVE]</button>
        </div>
        {adapter.renderValue?.({
          value: command.value,
          snapshot,
          onValueChange: (nextValue) => updateCommandValue(command.rawEnd, command.valueStart, command.valueEnd, nextValue),
        })}
      </div> : null)}
    </section> : null}
    {issues.length ? <div className="authored-text-errors" role="alert">
      {issues.map((issue) => <span key={`${issue.index}:${issue.message}`}>{issue.message}</span>)}
    </div> : null}
  </div>;
}
