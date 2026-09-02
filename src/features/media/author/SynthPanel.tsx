import { useEffect, useMemo, useState } from "react";
import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import type { SynthSound } from "../model";
import { applySynthPreset, createStarterSynth, type SynthPresetId } from "../synth";
import { playSynthSound } from "../ui/synthPlayback";
import "./mediaAuthor.css";

/** List workspace. Editing a sound is a child Author route rather than hidden local navigation. */
export function SynthPanel({ snapshot, onOpenSound, onNewSound }: {
  snapshot: ProjectSnapshot;
  onOpenSound: (sound: SynthSound) => void;
  onNewSound: () => void;
}) {
  return <section className="author-panel author-panel-frame synth-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>TINY SYNTH</span></header>
    <div className="author-panel-body synth-panel-body">
      <div className="definition-list synth-definition-list">
        {snapshot.synthSounds.map((sound) => <button type="button" key={sound.id} onClick={() => onOpenSound(sound)}><span>{sound.label}</span><span>{sound.voices.length} voice{sound.voices.length === 1 ? "" : "s"} · {sound.tempo} bpm</span></button>)}
      </div>
      {!snapshot.synthSounds.length ? <div className="workspace-empty">NO SYNTH SOUNDS YET.</div> : null}
      <button type="button" className="synth-create" onClick={onNewSound}>[+ SOUND]</button>
    </div>
  </section>;
}

export function SynthEditor({ snapshot, initial, onSave, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: SynthSound;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<SynthSound>(() => structuredClone(initial ?? { ...createStarterSynth(), key: "", label: "" }));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);

  useEffect(() => {
    setWorkspaceDirty(dirty);
    return () => setWorkspaceDirty(false);
  }, [dirty, setWorkspaceDirty]);

  const save = async () => {
    if (!draft.label.trim()) return;
    const sound = {
      ...draft,
      key: resolveAuthorKey({
        override: draft.key,
        source: draft.label,
        existingKeys: snapshot.synthSounds.filter((candidate) => candidate.id !== draft.id).map((candidate) => candidate.key),
        fallback: "sound",
      }),
    };
    setDraft(sound);
    setSaving(true);
    try {
      const result = await onSave([{ type: "synth.upsert", sound }], `${initial ? "Changed" : "Created"} synth ${sound.label}`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(sound));
        setWorkspaceDirty(false);
      }
    } finally { setSaving(false); }
  };

  return <section className="author-panel author-panel-frame synth-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>SOUND · {draft.label || "NEW"}</span></header>
    <div className="author-panel-body synth-panel-body">
      <div className="synth-editor focused-synth-editor">
        <section className="synth-section">
          <h3>RECIPE</h3>
          <label>LABEL <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} autoFocus /></label>
          <div className="form-grid">
            <label>TEMPO <input type="number" min={30} max={300} value={draft.tempo} onChange={(event) => setDraft({ ...draft, tempo: Number(event.target.value) })} /></label>
            <label className="check-label"><input type="checkbox" checked={draft.loop} onChange={(event) => setDraft({ ...draft, loop: event.target.checked })} /> loop recipe</label>
          </div>
          <GeneratedKeyField source={draft.label} value={draft.key} onChange={(key) => setDraft({ ...draft, key })} />
        </section>
        <section className="synth-section">
          <h3>VOICES</h3>
          <div className="synth-quick-start"><span>QUICK START</span>{(["blip", "chime", "alert", "hit"] as SynthPresetId[]).map((preset) => <button type="button" key={preset} onClick={() => { setDraft(applySynthPreset(draft, preset)); setVoiceIndex(0); void playSynthSound(applySynthPreset(draft, preset)); }}>[{preset.toUpperCase()}]</button>)}</div>
          <nav className="voice-tabs">{draft.voices.map((voice, index) => <button type="button" aria-pressed={voiceIndex === index} key={index} onClick={() => setVoiceIndex(index)}>[V{index + 1} {voice.waveform}]</button>)}</nav>
          {draft.voices[voiceIndex] ? <VoiceEditor sound={draft} voiceIndex={voiceIndex} onChange={setDraft} /> : <div className="workspace-empty">NO VOICE SELECTED.</div>}
        </section>
      </div>
    </div>
    <div className="author-panel-footer author-actions">
      <button type="button" onClick={() => void playSynthSound(draft)}>[PLAY]</button>
      <button type="button" disabled={saving || !dirty || !draft.label.trim()} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
    </div>
  </section>;
}

function VoiceEditor({ sound, voiceIndex, onChange }: { sound: SynthSound; voiceIndex: number; onChange: (sound: SynthSound) => void }) {
  const voice = sound.voices[voiceIndex];
  const updateVoice = (next: typeof voice) => onChange({ ...sound, voices: sound.voices.map((item, index) => index === voiceIndex ? next : item) });
  return <div className="voice-editor">
    <div className="voice-settings">
      <label>WAVE <select value={voice.waveform} onChange={(event) => updateVoice({ ...voice, waveform: event.target.value as typeof voice.waveform })}><option value="square">square</option><option value="triangle">triangle</option><option value="sawtooth">saw</option><option value="sine">sine</option><option value="noise">noise</option></select></label>
      <label>ATTACK <input type="number" step="0.01" min={0} max={1} value={voice.attack} onChange={(event) => updateVoice({ ...voice, attack: Number(event.target.value) })} /></label>
      <label>RELEASE <input type="number" step="0.01" min={0} max={1} value={voice.release} onChange={(event) => updateVoice({ ...voice, release: Number(event.target.value) })} /></label>
    </div>
    <div className="synth-steps">{voice.steps.map((step, index) => <div className={step.active ? "active" : ""} key={index}><button type="button" aria-label={`Toggle step ${index + 1}`} onClick={() => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, active: !item.active } : item) })}>{String(index + 1).padStart(2, "0")}</button>{voice.waveform !== "noise" ? <select aria-label={`Step ${index + 1} note`} value={step.note} onChange={(event) => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item) })}>{[2,3,4,5,6,7].flatMap((octave) => ["C","D","E","F","G","A","B"].map((note) => <option key={`${note}${octave}`} value={`${note}${octave}`}>{note}{octave}</option>))}</select> : null}</div>)}</div>
  </div>;
}
