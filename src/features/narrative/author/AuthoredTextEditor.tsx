import { useMemo, useRef, useState } from "react";
import { ValueMentionField } from "../../../author/ValueMentionField";
import {
  featureTextCueAuthorAdapter,
  featureTextCueAuthorAdapters,
} from "../../../author/textCues/catalog";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { TextCueType, TextPerformance } from "../model";
import { compileTextNotation, validateTextNotation } from "../textNotation";
import { TextRulesReference, type InlineTextRule } from "./TextRulesReference";
import "./authoredTextEditor.css";

const CORE_CUE_TYPES: readonly TextCueType[] = ["pause", "speed", "wave", "shake", "blink", "instant"];

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const issues = useMemo(() => validateTextNotation(value.text), [value.text]);
  const compiled = useMemo(
    () => compileTextNotation(value.text, value.performance),
    [value.text, value.performance],
  );
  const mediaCueAdapters = featureTextCueAuthorAdapters();
  const selectionLength = Math.max(0, selection.end - selection.start);

  const focusSelection = (start: number, end = start) => window.requestAnimationFrame(() => {
    textarea.current?.focus();
    textarea.current?.setSelectionRange(start, end);
    setSelection({ start, end });
  });

  const applyInlineRule = (rule: InlineTextRule) => {
    const selected = value.text.slice(selection.start, selection.end);
    const insertion = rule === "pause"
      ? "/p"
      : rule === "literal-slash"
        ? "//"
        : `/${rule}{${selected || "text"}}`;
    const nextText = `${value.text.slice(0, selection.start)}${insertion}${value.text.slice(selection.end)}`;
    onChange({ ...value, text: nextText });
    if (!selected && !["pause", "literal-slash"].includes(rule)) {
      const start = selection.start + 3;
      focusSelection(start, start + 4);
    } else {
      focusSelection(selection.start + insertion.length);
    }
  };

  const addCue = (type: TextCueType) => {
    const featureAdapter = featureTextCueAuthorAdapter(type);
    const cueValue = type === "pause"
      ? 350
      : type === "speed"
        ? 30
        : featureAdapter?.createValue?.(snapshot) ?? "";
    onChange({
      ...value,
      performance: {
        ...value.performance,
        cues: [...value.performance.cues, {
          id: crypto.randomUUID(),
          type,
          start: selection.start,
          end: selection.end,
          value: cueValue,
        }],
      },
    });
  };

  const updateCueValue = (cueId: string, cueValue: string | number | boolean | undefined) => onChange({
    ...value,
    performance: {
      ...value.performance,
      cues: value.performance.cues.map((cue) => cue.id === cueId ? { ...cue, value: cueValue } : cue),
    },
  });

  return <div className="authored-text-editor">
    <label className="authored-text-field">{label}
      <ValueMentionField
        snapshot={snapshot}
        multiline
        rows={rows}
        textareaRef={textarea}
        value={value.text}
        onValueChange={(text) => onChange({ ...value, text })}
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
        onChange={(event) => onChange({
          ...value,
          performance: { ...value.performance, charactersPerSecond: Math.max(1, Math.min(120, Number(event.target.value) || 1)) },
        })}
      /> chars/sec</label>
    </div>
    <TextRulesReference onApply={applyInlineRule} />
    {issues.length ? <div className="authored-text-errors" role="alert">
      {issues.map((issue) => <span key={`${issue.index}:${issue.message}`}>{issue.message}</span>)}
    </div> : null}
    <div className="authored-text-actions">
      <button type="button" onClick={() => setAdvancedOpen((open) => !open)}>
        [{advancedOpen ? "HIDE TIMELINE + MEDIA" : "TIMELINE + MEDIA"} · {value.performance.cues.length}]
      </button>
      {onPreview ? <button type="button" disabled={Boolean(issues.length)} onClick={() => onPreview(value)}>[PREVIEW IN PLAY]</button> : null}
    </div>
    {advancedOpen ? <section className="authored-text-cues">
      <p>Use this timeline for precise positions and media events. Inline Text Styles above are faster when an effect belongs directly to written words.</p>
      <p>{selectionLength ? `${selectionLength} selected · ${selection.start}:${selection.end}` : `Cursor ${selection.start}`}. Select text first, then add an event.</p>
      <div className="authored-text-cue-group">
        <strong>PRECISE DELIVERY</strong>
        <div className="authored-text-cue-buttons">{CORE_CUE_TYPES.map((type) => <button type="button" key={type} onClick={() => addCue(type)}>[+ {type.toUpperCase()}]</button>)}</div>
      </div>
      {mediaCueAdapters.length ? <div className="authored-text-cue-group">
        <strong>MEDIA EVENTS</strong>
        <div className="authored-text-cue-buttons">{mediaCueAdapters.map((adapter) => <button type="button" key={adapter.type} onClick={() => addCue(adapter.type)}>[+ {adapter.type.toUpperCase()}]</button>)}</div>
      </div> : null}
      <div className="authored-text-cue-list">
        {value.performance.cues.map((cue, index) => {
          const featureAdapter = featureTextCueAuthorAdapter(cue.type);
          return <div className="authored-text-cue-row" key={cue.id}>
            <span><strong>{index + 1}. {cue.type.toUpperCase()}</strong><small>{cue.start}:{cue.end}</small></span>
            {(cue.type === "pause" || cue.type === "speed") ? <input aria-label={`${cue.type} value`} type="number" value={Number(cue.value ?? 0)} onChange={(event) => updateCueValue(cue.id, Number(event.target.value))} /> : null}
            {featureAdapter?.renderValue({ cue, snapshot, onValueChange: (next) => updateCueValue(cue.id, next) })}
            <button type="button" onClick={() => onChange({ ...value, performance: { ...value.performance, cues: value.performance.cues.filter((item) => item.id !== cue.id) } })}>[REMOVE]</button>
          </div>;
        })}
        {!value.performance.cues.length ? <span className="muted">NO TIMELINE OR MEDIA EVENTS CONFIGURED.</span> : null}
      </div>
    </section> : null}
    <div className="performance-preview" aria-label={`${label} preview`}><PerformanceText text={compiled.text} performance={compiled.performance} /></div>
  </div>;
}

function PerformanceText({ text, performance }: { text: string; performance: TextPerformance }) {
  const segments: Array<{ text: string; classes: string[] }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const classes = performance.cues
      .filter((cue) => cue.start <= index && (cue.end > index || cue.start === cue.end))
      .map((cue) => `cue-${cue.type}`);
    const previous = segments.at(-1);
    if (previous && previous.classes.join(" ") === classes.join(" ")) previous.text += text[index];
    else segments.push({ text: text[index], classes });
  }
  return <>{segments.map((segment, index) => <span className={segment.classes.join(" ")} key={index}>{segment.text}</span>)}</>;
}
