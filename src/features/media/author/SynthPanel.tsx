import { useEffect, useMemo, useState } from "react";
import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import type { SynthSound } from "../model";
import {
  addSynthVoice,
  applySynthPreset,
  createStarterSynth,
  duplicateSynthVoice,
  MAX_SYNTH_STEPS,
  MAX_SYNTH_VOICES,
  removeSynthVoice,
  resizeSynthSequence,
  synthSequenceLength,
  type SynthPresetId,
  validateSynth,
} from "../synth";
import { playSynthSound } from "../ui/synthPlayback";
import "./mediaAuthor.css";
import { referencesTo } from "../../../author/references/projectReferences";

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

export function SynthEditor({ snapshot, initial, onSave, onCancel, setWorkspaceDirty }: {
  snapshot: ProjectSnapshot;
  initial?: SynthSound;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  setWorkspaceDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<SynthSound>(() => structuredClone(initial ?? { ...createStarterSynth(), key: "", label: "" }));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [baseline, draft]);
  const validationErrors = useMemo(() => validateSynth(draft), [draft]);
  const usages = initial ? referencesTo(snapshot, "synth-sound", initial.id) : [];
  const sequenceLength = synthSequenceLength(draft);

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

  const remove = async () => {
    if (!initial || usages.length || !window.confirm(`Delete synth sound “${initial.label}”?`)) return;
    setSaving(true);
    try {
      const result = await onSave([{ type: "synth.delete", id: initial.id }], `Deleted synth ${initial.label}`);
      if (result.status === "saved" || result.status === "queued") onCancel();
    } finally { setSaving(false); }
  };

  return <section className="author-panel author-panel-frame synth-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>SOUND · {draft.label || "NEW"}</span></header>
    <div className="author-panel-body synth-panel-body">
      <div className="synth-editor focused-synth-editor">
        <section className="synth-section">
          <h3>RECIPE</h3>
          <label>LABEL <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} autoFocus={!initial} /></label>
          <div className="form-grid">
            <label>TEMPO <input type="number" min={30} max={300} value={draft.tempo} onChange={(event) => setDraft({ ...draft, tempo: Number(event.target.value) })} /></label>
            <label className="check-label"><input type="checkbox" checked={draft.loop} onChange={(event) => setDraft({ ...draft, loop: event.target.checked })} /> loop recipe</label>
          </div>
          <GeneratedKeyField source={draft.label} value={draft.key} onChange={(key) => setDraft({ ...draft, key })} />
        </section>
        <section className="synth-section">
          <h3>QUICK START</h3>
          <p className="synth-help">Choose a working sound, name it, and save. Open Advanced only when you want to shape the recipe.</p>
          <div className="synth-quick-start">{(["blip", "chime", "alert", "hit"] as SynthPresetId[]).map((preset) => <button type="button" key={preset} onClick={() => {
            const next = applySynthPreset(draft, preset);
            setDraft(next);
            setVoiceIndex(0);
            void playSynthSound(next);
          }}>[{preset.toUpperCase()}]</button>)}</div>
          <div className="synth-complexity-summary">
            <span>{draft.voices.length} VOICE{draft.voices.length === 1 ? "" : "S"} · {sequenceLength} STEPS</span>
            <button type="button" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>[{advanced ? "HIDE ADVANCED" : "ADVANCED OPTIONS"}]</button>
          </div>
        </section>
        {advanced ? <section className="synth-section synth-advanced" aria-label="Advanced synth options">
          <h3>ADVANCED VOICES + SEQUENCE</h3>
          <div className="synth-structure-controls">
            <label>SEQUENCE LENGTH
              <input type="number" min={1} max={MAX_SYNTH_STEPS} value={sequenceLength} onChange={(event) => setDraft(resizeSynthSequence(draft, Number(event.target.value)))} />
              <small>Applied to every voice. Maximum {MAX_SYNTH_STEPS} steps.</small>
            </label>
            <div className="author-actions synth-voice-actions">
              <button type="button" disabled={draft.voices.length >= MAX_SYNTH_VOICES} onClick={() => { setDraft(addSynthVoice(draft)); setVoiceIndex(draft.voices.length); }}>[+ VOICE]</button>
              <button type="button" disabled={draft.voices.length >= MAX_SYNTH_VOICES} onClick={() => { setDraft(duplicateSynthVoice(draft, voiceIndex)); setVoiceIndex(draft.voices.length); }}>[DUPLICATE]</button>
              <button type="button" disabled={draft.voices.length <= 1} onClick={() => { setDraft(removeSynthVoice(draft, voiceIndex)); setVoiceIndex(Math.max(0, Math.min(voiceIndex, draft.voices.length - 2))); }}>[REMOVE VOICE]</button>
            </div>
          </div>
          <nav className="voice-tabs" aria-label="Synth voices">{draft.voices.map((voice, index) => <button type="button" aria-pressed={voiceIndex === index} key={index} onClick={() => setVoiceIndex(index)}>[V{index + 1} {voice.waveform}]</button>)}</nav>
          {draft.voices[voiceIndex] ? <VoiceEditor sound={draft} voiceIndex={voiceIndex} onChange={setDraft} /> : <div className="workspace-empty">NO VOICE SELECTED.</div>}
        </section> : null}
        {validationErrors.length ? <div className="synth-validation" role="alert">{validationErrors.map((error) => <span key={error}>{error}</span>)}</div> : null}
      </div>
    </div>
    <div className="author-panel-footer author-actions">
      <button type="button" onClick={() => void playSynthSound(draft)}>[PLAY]</button>
      <button type="button" disabled={saving || !dirty || !draft.label.trim() || validationErrors.length > 0} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
      {initial ? <button type="button" className="danger" disabled={saving || usages.length > 0} title={usages.length ? `Used by ${usages.map((usage) => usage.ownerLabel).join(", ")}` : undefined} onClick={() => void remove()}>[DELETE{usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}]</button> : null}
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
    <div className="synth-steps">{voice.steps.map((step, index) => <div className={step.active ? "active" : ""} key={index}>
      <button type="button" aria-label={`Toggle step ${index + 1}`} aria-pressed={step.active} onClick={() => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, active: !item.active } : item) })}>{String(index + 1).padStart(2, "0")}</button>
      {voice.waveform !== "noise" ? <select aria-label={`Step ${index + 1} note`} value={step.note} onChange={(event) => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item) })}>{[2,3,4,5,6,7].flatMap((octave) => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"].map((note) => <option key={`${note}${octave}`} value={`${note}${octave}`}>{note}{octave}</option>))}</select> : <span className="synth-noise-step">NOISE</span>}
      <label className="synth-step-volume"><span>VOL {Math.round(step.volume * 100)}</span><input aria-label={`Step ${index + 1} volume`} type="range" min={0} max={1} step={0.01} value={step.volume} onChange={(event) => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, volume: Number(event.target.value) } : item) })} /></label>
    </div>)}</div>
  </div>;
}
