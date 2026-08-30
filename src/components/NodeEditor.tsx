import { useRef, useState } from "react";
import type { GameNode, MutationOperation, ProjectSnapshot, TextCueType } from "../game/model";
import { ASSET_MANIFEST } from "../generated/assetManifest";
import { ValueTokenBar } from "./AuthorFields";

export function NodeEditor({ node, snapshot, onSave, onCancel }: {
  node: GameNode;
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [saving, setSaving] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const insertToken = (token: string) => {
    const start = textarea.current?.selectionStart ?? draft.text.length;
    const end = textarea.current?.selectionEnd ?? start;
    setDraft({ ...draft, text: `${draft.text.slice(0, start)}${token}${draft.text.slice(end)}` });
  };

  const addCue = (type: TextCueType) => {
    const start = textarea.current?.selectionStart ?? 0;
    const end = Math.max(start, textarea.current?.selectionEnd ?? start);
    const value = type === "pause" ? 350 : type === "speed" ? 30 : "";
    setDraft({
      ...draft,
      performance: {
        ...draft.performance,
        cues: [...draft.performance.cues, { id: crypto.randomUUID(), type, start, end, value }],
      },
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave([{ type: "node.upsert", node: draft }], `Changed node #${draft.nodeNumber}`);
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel author-panel-frame node-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>NODE #{draft.nodeNumber}</span><button type="button" onClick={onCancel}>[X]</button></header>
    <div className="author-panel-body">
      <label>NODE-TEXT <textarea ref={textarea} rows={5} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} autoFocus /></label>
      <ValueTokenBar snapshot={snapshot} onInsert={insertToken} />
      <details className="advanced-author-details">
        <summary>[TEXT BEHAVIOR + NODE DETAILS]</summary>
        <div className="node-meta-grid">
          <label>TYPE SPEED <input type="number" min={1} max={120} value={draft.performance.charactersPerSecond} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, charactersPerSecond: Number(event.target.value) } })} /></label>
          <label className="check-label"><input type="checkbox" checked={draft.ending} onChange={(event) => setDraft({ ...draft, ending: event.target.checked })} /> intentional ending [E]</label>
          <label>CHARACTER / SPEAKER <select value={draft.characterId ?? ""} onChange={(event) => setDraft({ ...draft, characterId: event.target.value || null })}><option value="">none</option>{snapshot.entities.filter((entity) => entity.type === "character").map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
          <label>LOCATION <select value={draft.locationId ?? ""} onChange={(event) => setDraft({ ...draft, locationId: event.target.value || null })}><option value="">none</option>{snapshot.entities.filter((entity) => entity.type === "location").map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
          <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        </div>
        <div className="performance-editor">
          <span>SELECT TEXT OR PLACE CURSOR, THEN:</span>
          <div className="cue-buttons">{(["pause", "speed", "wave", "shake", "blink", "instant", "synth", "audio", "sprite"] as TextCueType[]).map((type) => <button type="button" key={type} onClick={() => addCue(type)}>[{type.toUpperCase()}]</button>)}</div>
          {draft.performance.cues.map((cue, index) => <div className="cue-row" key={cue.id}>
            <span>{cue.type} {cue.start}:{cue.end}</span>
            {(cue.type === "pause" || cue.type === "speed") ? <input type="number" value={Number(cue.value ?? 0)} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.map((item) => item.id === cue.id ? { ...item, value: Number(event.target.value) } : item) } })} /> : null}
            {cue.type === "synth" ? <select value={String(cue.value ?? "")} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.map((item) => item.id === cue.id ? { ...item, value: event.target.value } : item) } })}><option value="">choose synth</option>{snapshot.synthSounds.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select> : null}
            {(cue.type === "audio" || cue.type === "sprite") ? <select value={String(cue.value ?? "")} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.map((item) => item.id === cue.id ? { ...item, value: event.target.value } : item) } })}><option value="">choose asset</option>{ASSET_MANIFEST.filter((asset) => asset.runtimePath && (cue.type === "audio" ? asset.type === "audio" : asset.type === "image")).map((asset) => <option key={asset.path} value={asset.runtimePath!}>{asset.path}</option>)}</select> : null}
            <button type="button" onClick={() => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.filter((_, itemIndex) => itemIndex !== index) } })}>[REMOVE]</button>
          </div>)}
          <div className="performance-preview" aria-label="Text performance preview"><PerformanceText node={draft} /></div>
        </div>
      </details>
    </div>
    <div className="author-actions author-panel-footer"><button type="button" disabled={saving} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}

function PerformanceText({ node }: { node: GameNode }) {
  const segments: Array<{ text: string; classes: string[] }> = [];
  for (let index = 0; index < node.text.length; index += 1) {
    const classes = node.performance.cues
      .filter((cue) => cue.start <= index && (cue.end > index || cue.start === cue.end))
      .map((cue) => `cue-${cue.type}`);
    const previous = segments.at(-1);
    if (previous && previous.classes.join(" ") === classes.join(" ")) previous.text += node.text[index];
    else segments.push({ text: node.text[index], classes });
  }
  return <>{segments.map((segment, index) => <span className={segment.classes.join(" ")} key={index}>{segment.text}</span>)}</>;
}
