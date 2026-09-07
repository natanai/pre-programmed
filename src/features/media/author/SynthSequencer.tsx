import { useEffect, useState } from "react";
import type { SynthSound } from "../model";
import {
  addSynthVoice,
  duplicateSynthVoice,
  MAX_SYNTH_STEPS,
  MAX_SYNTH_VOICES,
  removeSynthVoice,
  resizeSynthSequence,
  synthSequenceLength,
} from "../synth";
import "./mediaAuthor.css";

/**
 * Feature-owned sequencer control used inside the shared structured Synth task.
 * Draft ownership, dirty state, validation, Save, delete, and task navigation
 * stay with the structured Author workspace; this component owns only direct
 * manipulation of voices and sequence steps.
 */
export function SynthSequencer({ sound, onChange }: {
  sound: SynthSound;
  onChange: (sound: SynthSound) => void;
}) {
  const [voiceIndex, setVoiceIndex] = useState(0);
  const sequenceLength = synthSequenceLength(sound);

  useEffect(() => {
    setVoiceIndex((current) => Math.max(0, Math.min(current, sound.voices.length - 1)));
  }, [sound.voices.length]);

  const addVoice = () => {
    const next = addSynthVoice(sound);
    onChange(next);
    setVoiceIndex(Math.max(0, next.voices.length - 1));
  };

  const duplicateVoice = () => {
    const next = duplicateSynthVoice(sound, voiceIndex);
    onChange(next);
    setVoiceIndex(Math.max(0, next.voices.length - 1));
  };

  const removeVoice = () => {
    const next = removeSynthVoice(sound, voiceIndex);
    onChange(next);
    setVoiceIndex((current) => Math.max(0, Math.min(current, next.voices.length - 1)));
  };

  return <div className="synth-sequencer">
    <div className="synth-structure-controls">
      <label>SEQUENCE LENGTH
        <input
          type="number"
          min={1}
          max={MAX_SYNTH_STEPS}
          step={1}
          value={sequenceLength}
          onChange={(event) => onChange(resizeSynthSequence(sound, Number(event.target.value)))}
        />
        <small>Applied to every voice. Maximum {MAX_SYNTH_STEPS} steps.</small>
      </label>
      <div className="author-actions synth-voice-actions">
        <button type="button" disabled={sound.voices.length >= MAX_SYNTH_VOICES} onClick={addVoice}>[+ VOICE]</button>
        <button type="button" disabled={sound.voices.length >= MAX_SYNTH_VOICES} onClick={duplicateVoice}>[DUPLICATE]</button>
        <button type="button" disabled={sound.voices.length <= 1} onClick={removeVoice}>[REMOVE VOICE]</button>
      </div>
    </div>

    <nav className="voice-tabs" aria-label="Synth voices">
      {sound.voices.map((voice, index) => <button
        type="button"
        aria-pressed={voiceIndex === index}
        key={index}
        onClick={() => setVoiceIndex(index)}
      >[V{index + 1} {voice.waveform}]</button>)}
    </nav>

    {sound.voices[voiceIndex]
      ? <VoiceEditor sound={sound} voiceIndex={voiceIndex} onChange={onChange} />
      : <div className="workspace-empty">NO VOICE SELECTED.</div>}
  </div>;
}

function VoiceEditor({ sound, voiceIndex, onChange }: {
  sound: SynthSound;
  voiceIndex: number;
  onChange: (sound: SynthSound) => void;
}) {
  const voice = sound.voices[voiceIndex];
  const updateVoice = (next: typeof voice) => onChange({
    ...sound,
    voices: sound.voices.map((item, index) => index === voiceIndex ? next : item),
  });

  return <div className="voice-editor">
    <div className="voice-settings">
      <label>WAVE
        <select value={voice.waveform} onChange={(event) => updateVoice({ ...voice, waveform: event.target.value as typeof voice.waveform })}>
          <option value="square">square</option>
          <option value="triangle">triangle</option>
          <option value="sawtooth">saw</option>
          <option value="sine">sine</option>
          <option value="noise">noise</option>
        </select>
      </label>
      <label>ATTACK
        <input type="number" step="0.01" min={0} max={1} value={voice.attack} onChange={(event) => updateVoice({ ...voice, attack: Number(event.target.value) })} />
      </label>
      <label>RELEASE
        <input type="number" step="0.01" min={0} max={1} value={voice.release} onChange={(event) => updateVoice({ ...voice, release: Number(event.target.value) })} />
      </label>
    </div>
    <div className="synth-steps">
      {voice.steps.map((step, index) => <div className={step.active ? "active" : ""} key={index}>
        <button
          type="button"
          aria-label={`Toggle step ${index + 1}`}
          aria-pressed={step.active}
          onClick={() => updateVoice({
            ...voice,
            steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, active: !item.active } : item),
          })}
        >{String(index + 1).padStart(2, "0")}</button>
        {voice.waveform !== "noise" ? <select
          aria-label={`Step ${index + 1} note`}
          value={step.note}
          onChange={(event) => updateVoice({
            ...voice,
            steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item),
          })}
        >
          {[2, 3, 4, 5, 6, 7].flatMap((octave) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((note) => <option key={`${note}${octave}`} value={`${note}${octave}`}>{note}{octave}</option>))}
        </select> : <span className="synth-noise-step">NOISE</span>}
        <label className="synth-step-volume">
          <span>VOL {Math.round(step.volume * 100)}</span>
          <input
            aria-label={`Step ${index + 1} volume`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={step.volume}
            onChange={(event) => updateVoice({
              ...voice,
              steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, volume: Number(event.target.value) } : item),
            })}
          />
        </label>
      </div>)}
    </div>
  </div>;
}
