import { useEffect, useRef, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import {
  FEATURE_TEXT_CUE_AUTHOR_ADAPTER_BY_TYPE,
  FEATURE_TEXT_CUE_AUTHOR_ADAPTERS,
} from "../../../author/textCues/catalog";
import type { GameNode, MutationOperation, ProjectSnapshot, TextCueType } from "../../../game/model";
import { compileTextNotation } from "../../../game/textNotation";
import { ValueMentionField } from "../../../author/ValueMentionField";
import { TextRulesReference } from "./TextRulesReference";
import "./nodeEditor.css";

type NodeScreen = "text" | "context" | "cues";

const CORE_CUE_TYPES: readonly TextCueType[] = ["pause", "speed", "wave", "shake", "blink", "instant"];

export function NodeEditor({ node, snapshot, onSave, onCancel, onDirtyChange }: {
  node: GameNode;
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(node));
  const [screen, setScreen] = useState<NodeScreen>("text");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [saving, setSaving] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    onDirtyChange(draftSignature !== savedSignature);
    return () => onDirtyChange(false);
  }, [draftSignature, savedSignature, onDirtyChange]);

  const rememberSelection = () => {
    const start = textarea.current?.selectionStart ?? 0;
    const end = Math.max(start, textarea.current?.selectionEnd ?? start);
    setSelection({ start, end });
  };

  const openCues = () => {
    rememberSelection();
    setScreen("cues");
  };

  const addCue = (type: TextCueType) => {
    const featureAdapter = FEATURE_TEXT_CUE_AUTHOR_ADAPTER_BY_TYPE[type];
    const value = type === "pause"
      ? 350
      : type === "speed"
        ? 30
        : featureAdapter?.createValue?.(snapshot) ?? "";
    setDraft({
      ...draft,
      performance: {
        ...draft.performance,
        cues: [...draft.performance.cues, {
          id: crypto.randomUUID(),
          type,
          start: selection.start,
          end: selection.end,
          value,
        }],
      },
    });
  };

  const updateCueValue = (cueId: string, value: string | number | boolean | undefined) => {
    setDraft({
      ...draft,
      performance: {
        ...draft.performance,
        cues: draft.performance.cues.map((item) => item.id === cueId ? { ...item, value } : item),
      },
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await onSave([{ type: "node.upsert", node: draft }], `Changed node #${draft.nodeNumber}`);
      if (result.status === "saved" || result.status === "queued") setSavedSignature(draftSignature);
    } finally {
      setSaving(false);
    }
  };

  const speaker = snapshot.entities.find((entity) => entity.id === draft.characterId)?.name ?? "None";
  const location = snapshot.entities.find((entity) => entity.id === draft.locationId)?.name ?? "None";
  const screenTitle = screen === "text" ? `NODE #${draft.nodeNumber}` : screen.toUpperCase();
  const selectionLength = Math.max(0, selection.end - selection.start);
  const selectionLabel = selectionLength
    ? `${selectionLength} selected · ${selection.start}:${selection.end}`
    : `cursor ${selection.start}`;
  const availableCueTypes: readonly TextCueType[] = [
    ...CORE_CUE_TYPES,
    ...FEATURE_TEXT_CUE_AUTHOR_ADAPTERS.map((adapter) => adapter.type),
  ];

  return <section className="author-panel author-panel-frame node-editor focused-node-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header className="focused-node-header">
      {screen !== "text" ? <button type="button" className="focused-node-back" onClick={() => setScreen("text")}>[‹]</button> : null}
      <span>{screenTitle}</span>
      {screen !== "text" ? <small>NODE #{draft.nodeNumber}</small> : null}
    </header>

    <div className="author-panel-body focused-node-body">
      {screen === "text" ? <>
        <label className="node-text-field">NODE TEXT
          <ValueMentionField
            snapshot={snapshot}
            multiline
            rows={6}
            textareaRef={textarea}
            value={draft.text}
            onValueChange={(text) => setDraft({ ...draft, text })}
            onSelectionChange={setSelection}
            autoFocus
          />
        </label>
        <div className="node-writing-meta" aria-live="polite">
          <span>{draft.text.length} character{draft.text.length === 1 ? "" : "s"}</span>
        </div>
        <TextRulesReference />

        <div className="node-summary-list">
          <button type="button" onClick={() => setScreen("context")}>
            <span><strong>CONTEXT</strong><small>{speaker} · {location}{draft.tags.length ? ` · ${draft.tags.length} tag${draft.tags.length === 1 ? "" : "s"}` : ""}</small></span><span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={openCues}>
            <span><strong>ADVANCED CUES</strong><small>{draft.performance.cues.length ? `${draft.performance.cues.length} configured · ${selectionLabel}` : `None · ${selectionLabel}`}</small></span><span aria-hidden="true">›</span>
          </button>
        </div>

        <label className="check-label node-ending-toggle"><input type="checkbox" checked={draft.ending} onChange={(event) => setDraft({ ...draft, ending: event.target.checked })} /> intentional ending [E]</label>
        <div className="performance-preview" aria-label="Text performance preview"><PerformanceText node={draft} /></div>
      </> : null}

      {screen === "context" ? <div className="node-focused-form">
        <h3>WHO / WHERE IS THIS TEXT?</h3>
        <label>CHARACTER / SPEAKER <ReferenceField kind="character" value={draft.characterId ?? ""} onChange={(characterId) => setDraft({ ...draft, characterId: characterId || null })} placeholder="none" /></label>
        <label>LOCATION <ReferenceField kind="location" value={draft.locationId ?? ""} onChange={(locationId) => setDraft({ ...draft, locationId: locationId || null })} placeholder="none" /></label>
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
      </div> : null}

      {screen === "cues" ? <div className="node-cue-workspace">
        <h3>ADVANCED CUES · {selectionLabel.toUpperCase()}</h3>
        <p className="muted">Use inline text rules for ordinary rhythm and word delivery. Advanced cues provide precise positioned values plus any capabilities contributed by installed features.</p>
        <div className="cue-buttons">{availableCueTypes.map((type) => <button type="button" key={type} onClick={() => addCue(type)}>[+ {type.toUpperCase()}]</button>)}</div>
        <div className="node-cue-list">
          {draft.performance.cues.map((cue, index) => {
            const featureAdapter = FEATURE_TEXT_CUE_AUTHOR_ADAPTER_BY_TYPE[cue.type];
            return <div className="cue-row" key={cue.id}>
              <span><strong>{index + 1}. {cue.type.toUpperCase()}</strong><small>{cue.start}:{cue.end}</small></span>
              {(cue.type === "pause" || cue.type === "speed") ? <input aria-label={`${cue.type} value`} type="number" value={Number(cue.value ?? 0)} onChange={(event) => updateCueValue(cue.id, Number(event.target.value))} /> : null}
              {featureAdapter?.renderValue({ cue, snapshot, onValueChange: (value) => updateCueValue(cue.id, value) })}
              <button type="button" onClick={() => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.filter((_, itemIndex) => itemIndex !== index) } })}>[REMOVE]</button>
            </div>;
          })}
          {!draft.performance.cues.length ? <span className="muted">NO ADVANCED CUES CONFIGURED.</span> : null}
        </div>
        <div className="performance-preview"><PerformanceText node={draft} /></div>
      </div> : null}
    </div>

    <div className="author-actions author-panel-footer"><button type="button" disabled={saving} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}

function PerformanceText({ node }: { node: GameNode }) {
  const compiled = compileTextNotation(node.text, node.performance);
  const segments: Array<{ text: string; classes: string[] }> = [];
  for (let index = 0; index < compiled.text.length; index += 1) {
    const classes = compiled.performance.cues
      .filter((cue) => cue.start <= index && (cue.end > index || cue.start === cue.end))
      .map((cue) => `cue-${cue.type}`);
    const previous = segments.at(-1);
    if (previous && previous.classes.join(" ") === classes.join(" ")) previous.text += compiled.text[index];
    else segments.push({ text: compiled.text[index], classes });
  }
  return <>{segments.map((segment, index) => <span className={segment.classes.join(" ")} key={index}>{segment.text}</span>)}</>;
}
