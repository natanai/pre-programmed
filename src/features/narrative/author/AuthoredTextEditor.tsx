import { useMemo, useRef, useState } from "react";
import { ValueMentionField } from "../../../author/ValueMentionField";
import {
  featureTextCueAuthorAdapterForCode,
  featureTextCueAuthorAdapters,
} from "../../../author/textCues/catalog";
import { scanInlineTextCommands } from "../../../engine/presentation/inlineTextCommandCatalog";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { TextPerformance } from "../model";
import { compileTextNotation, validateTextNotation } from "../textNotation";
import { TextRulesReference, type InlineTextRule } from "./TextRulesReference";
import "./authoredTextEditor.css";

export type AuthoredTextValue = {
  text: string;
  performance: TextPerformance;
};

export function AuthoredTextEditor({
  value,
  snapshot,
  label,
  rows = 6,
  autoFocus = false,
  onChange,
  onPreview,
}: {
  value: AuthoredTextValue;
  snapshot: ProjectSnapshot;
  label: string;
  rows?: number;
  autoFocus?: boolean;
  onChange: (value: AuthoredTextValue) => void;
  onPreview?: (value: AuthoredTextValue) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const issues = useMemo(() => validateTextNotation(value.text), [value.text]);
  const compiled = useMemo(
    () => compileTextNotation(value.text, value.performance),
    [value.text, value.performance],
  );
  const featureCommands = featureTextCueAuthorAdapters();
  const configuredCommands = scanInlineTextCommands(value.text)
    .map((command) => ({ command, adapter: featureTextCueAuthorAdapterForCode(command.definition.code) }))
    .filter((entry) => Boolean(entry.adapter?.renderValue));

  const emit = (next: AuthoredTextValue) => onChange({
    ...next,
    performance: { ...next.performance, cues: [] },
  });

  const focusSelection = (start: number, end = start) => window.requestAnimationFrame(() => {
    textarea.current?.focus();
    textarea.current?.setSelectionRange(start, end);
    setSelection({ start, end });
  });

  const preserveSelectionWithoutFocus = (start: number, end = start) => window.requestAnimationFrame(() => {
    textarea.current?.setSelectionRange(start, end);
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
      focusSelection(start, start + 4);
    } else {
      focusSelection(selection.start + insertion.length);
    }
  };

  const applyFeatureCommand = (code: string) => {
    const insertion = `/${code}{}`;
    const at = selection.end;
    const nextText = `${value.text.slice(0, at)}${insertion}${value.text.slice(at)}`;
    emit({ ...value, text: nextText });
    const insideBraces = at + code.length + 2;
    preserveSelectionWithoutFocus(insideBraces);
  };

  const updateCommandValue = (rawEnd: number, valueStart: number, valueEnd: number, nextValue: string) => {
    const safeValue = nextValue.replaceAll("}", "");
    const nextText = `${value.text.slice(0, valueStart)}${safeValue}${value.text.slice(valueEnd)}`;
    emit({ ...value, text: nextText });
    const nextCommandEnd = rawEnd + safeValue.length - (valueEnd - valueStart);
    preserveSelectionWithoutFocus(nextCommandEnd);
  };

  const removeCommand = (rawStart: number, rawEnd: number) => {
    const nextText = `${value.text.slice(0, rawStart)}${value.text.slice(rawEnd)}`;
    emit({ ...value, text: nextText });
    preserveSelectionWithoutFocus(rawStart);
  };

  return <div className="authored-text-editor">
    <label className="authored-text-field">{label}
      <ValueMentionField
        snapshot={snapshot}
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
    <div className="authored-text-meta">
      <span>{value.text.length} character{value.text.length === 1 ? "" : "s"}</span>
      <label>SPEED <input
        type="number"
        min={1}
        max={120}
        value={value.performance.charactersPerSecond}
        onChange={(event) => emit({
          ...value,
          performance: { ...value.performance, charactersPerSecond: Math.max(1, Math.min(120, Number(event.target.value) || 1)) },
        })}
      /> chars/sec</label>
    </div>
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
    <div className="authored-text-actions">
      {onPreview ? <button type="button" disabled={Boolean(issues.length)} onClick={() => onPreview({
        ...value,
        performance: { ...value.performance, cues: [] },
      })}>[PREVIEW IN PLAY]</button> : null}
    </div>
    <div className="performance-preview" aria-label={`${label} preview`}><PerformanceText text={compiled.text} performance={compiled.performance} /></div>
  </div>;
}

function PerformanceText({ text, performance }: { text: string; performance: TextPerformance }) {
  const segments: Array<{ text: string; classes: string[] }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const classes = performance.cues
      .filter((cue) => ["wave", "shake", "blink"].includes(cue.type) && cue.start <= index && cue.end > index)
      .map((cue) => `cue-${cue.type}`);
    const previous = segments.at(-1);
    if (previous && previous.classes.join(" ") === classes.join(" ")) previous.text += text[index];
    else segments.push({ text: text[index], classes });
  }
  return <>{segments.map((segment, index) => <span className={segment.classes.join(" ")} key={index}>{segment.text}</span>)}</>;
}
