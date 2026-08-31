import { useRef, useState } from "react";
import type { GameNode, MutationOperation, ProjectSnapshot, TextCueType } from "../../../game/model";
import { compileTextNotation } from "../../../game/textNotation";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";
import { ValueMentionField } from "../../../author/ValueMentionField";
import "./nodeEditor.css";

type NodeScreen = "text" | "context" | "presentation" | "cues";

type TextSelection = { start: number; end: number };

export function NodeEditor({ node, snapshot, onSave, onCancel }: {
  node: GameNode;
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [screen, setScreen] = useState<NodeScreen>("text");
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [saving, setSaving] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

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
    const value = type === "pause" ? 350 : type === "speed" ? 30 : "";
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

  const save = async () => {
    setSaving(true);
    try {
      await onSave([{ type: "node.upsert", node: draft }], `Changed node #${draft.nodeNumber}`);
    } finally {
      setSaving(false);
    }
  };

  const speaker = snapshot.entities.find((entity) => entity.id === draft.characterId)?.name ?? "None";
  const location = snapshot.entities.find((entity) => entity.id === draft.locationId)?.name ?? "None";
  const screenTitle = screen === "text" ? `NODE #${draft.nodeNumber}` : screen.toUpperCase();

  return <section className="author-panel author-panel-frame node-editor focused-node-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header className="focused-node-header">
      {screen !== "text" ? <button type="button" className="focused-node-back" onClick={() => setScreen("text")}>[‹]</button> : null}
      <span>{screenTitle}</span>
      {screen !== "text" ? <small>NODE #{draft.nodeNumber}</small> : null}
    </header>

    <div className="author-panel-body focused-node-body">
      {screen === "text" ? <>
        <label>NODE TEXT
          <ValueMentionField
            snapshot={snapshot}
            multiline
            rows={6}
            textareaRef={textarea}
            value={draft.text}
            onValueChange={(text) => setDraft({ ...draft, text })}
            autoFocus
          />
        </label>
        <div className="field-help">INLINE TEXT: /p pause · /p800 custom pause · /f{'{fast}'} · /s{'{shout}'} · /h{'{hit}'} · /w{'{wave}'} · /b{'{blink}'} · /i{'{instant}'} · // literal slash</div>

        <div className="node-summary-list">
          <button type="button" onClick={() => setScreen("context")}>
            <span><strong>CONTEXT</strong><small>{speaker} · {location}{draft.tags.length ? ` · ${draft.tags.length} tag${draft.tags.length === 1 ? "" : "s"}` : ""}</small></span><span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={() => setScreen("presentation")}>
            <span><strong>PRESENTATION</strong><small>{draft.performance.charactersPerSecond} characters/second</small></span><span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={openCues}>
            <span><strong>CUES</strong><small>{draft.performance.cues.length ? `${draft.performance.cues.length} configured · selection ${selection.start}:${selection.end}` : "None · select text first for ranged cues"}</small></span><span aria-hidden="true">›</span>
          </button>
        </div>

        <label className="check-label node-ending-toggle"><input type="checkbox" checked={draft.ending} onChange={(event) => setDraft({ ...draft, ending: event.target.checked })} /> intentional ending [E]</label>
        <div className="performance-preview" aria-label="Text performance preview"><PerformanceText node={draft} /></div>
      </> : null}

      {screen === "context" ? <div className="node-focused-form">
        <h3>WHO / WHERE IS THIS TEXT?</h3>
        <label>CHARACTER / SPEAKER <select value={draft.characterId ?? ""} onChange={(event) => setDraft({ ...draft, characterId: event.target.value || null })}><option value="">none</option>{snapshot.entities.filter((entity) => entity.type === "character").map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
        <label>LOCATION <select value={draft.locationId ?? ""} onChange={(event) => setDraft({ ...draft, locationId: event.target.value || null })}><option value="">none</option>{snapshot.entities.filter((entity) => entity.type === "location").map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
      </div> : null}

      {screen === "presentation" ? <div className="node-focused-form">
        <h3>DEFAULT TEXT PRESENTATION</h3>
        <label>CHARACTERS / SECOND <input type="number" min={1} max={120} value={draft.performance.charactersPerSecond} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, charactersPerSecond: Number(event.target.value) } })} /></label>
        <p className="muted">Inline notation can temporarily change presentation inside the text. This value is the node's default rate.</p>
        <div className="performance-preview"><PerformanceText node={draft} /></div>
      </div> : null}

      {screen === "cues" ? <div className="node-cue-workspace">
        <h3>CUES AT {selection.start}:{selection.end}</h3>
        <p className="muted">Return to Node Text to change the selected range, then reopen Cues. A collapsed selection applies at the cursor position.</p>
        <div className="cue-buttons">{(["pause", "speed", "wave", "shake", "blink", "instant", "synth", "audio", "sprite"] as TextCueType[]).map((type) => <button type="button" key={type} onClick={() => addCue(type)}>[+ {type.toUpperCase()}]</button>)}</div>
        <div className="node-cue-list">
          {draft.performance.cues.map((cue, index) => <div className="cue-row" key={cue.id}>
            <span><strong>{index + 1}. {cue.type.toUpperCase()}</strong><small>{cue.start}:{cue.end}</small></span>
            {(cue.type === "pause" || cue.type === "speed") ? <input aria-label={`${cue.type} value`} type="number" value={Number(cue.value ?? 0)} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.map((item) => item.id === cue.id ? { ...item, value: Number(event.target.value) } : item) } })} /> : null}
            {cue.type === "synth" ? <select aria-label="Synth cue sound" value={String(cue.value ?? "")} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.map((item) => item.id === cue.id ? { ...item, value: event.target.value } : item) } })}><option value="">choose synth</option>{snapshot.synthSounds.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select> : null}
            {(cue.type === "audio" || cue.type === "sprite") ? <select aria-label={`${cue.type} cue asset`} value={String(cue.value ?? "")} onChange={(event) => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.map((item) => item.id === cue.id ? { ...item, value: event.target.value } : item) } })}><option value="">choose asset</option>{ASSET_MANIFEST.filter((asset) => asset.runtimePath && (cue.type === "audio" ? asset.type === "audio" : asset.type === "image")).map((asset) => <option key={asset.path} value={asset.runtimePath!}>{asset.path}</option>)}</select> : null}
            <button type="button" onClick={() => setDraft({ ...draft, performance: { ...draft.performance, cues: draft.performance.cues.filter((_, itemIndex) => itemIndex !== index) } })}>[REMOVE]</button>
          </div>)}
          {!draft.performance.cues.length ? <span className="muted">NO CUES CONFIGURED.</span> : null}
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
