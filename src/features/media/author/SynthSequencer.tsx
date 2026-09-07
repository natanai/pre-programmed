import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SynthSound, SynthStep } from "../model";
import {
  addSynthVoice,
  duplicateSynthVoice,
  MAX_SYNTH_STEPS,
  MAX_SYNTH_VOICES,
  removeSynthVoice,
  resizeSynthSequence,
  synthSequenceLength,
} from "../synth";
import { playSynthStep } from "../ui/synthPlayback";
import "./mediaAuthor.css";

const PITCHES = [2, 3, 4, 5, 6, 7].flatMap((octave) =>
  ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((note) => `${note}${octave}`),
);

const WAVEFORMS = [
  { value: "square", label: "SQUARE" },
  { value: "triangle", label: "TRI" },
  { value: "sawtooth", label: "SAW" },
  { value: "sine", label: "SINE" },
  { value: "noise", label: "NOISE" },
] as const;

const VOICE_SHAPES = [
  { id: "tight", label: "TIGHT", attack: 0, release: 0.05 },
  { id: "punch", label: "PUNCH", attack: 0, release: 0.12 },
  { id: "soft", label: "SOFT", attack: 0.06, release: 0.18 },
  { id: "ring", label: "RING", attack: 0.01, release: 0.4 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pitchIndex(note: string) {
  const index = PITCHES.indexOf(note);
  return index >= 0 ? index : PITCHES.indexOf("C4");
}

function shiftedPitch(note: string, amount: number) {
  return PITCHES[clamp(pitchIndex(note) + amount, 0, PITCHES.length - 1)];
}

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
  const [stepIndex, setStepIndex] = useState(0);
  const pitchDrag = useRef<{ pointerId: number; startY: number; startIndex: number; lastDelta: number } | null>(null);

  useEffect(() => {
    setStepIndex(0);
  }, [voiceIndex]);

  useEffect(() => {
    setStepIndex((current) => Math.max(0, Math.min(current, voice.steps.length - 1)));
  }, [voice.steps.length]);

  const selectedIndex = Math.max(0, Math.min(stepIndex, voice.steps.length - 1));
  const selectedStep = voice.steps[selectedIndex];

  const updateVoice = (next: typeof voice, audition = false) => {
    const nextSound = {
      ...sound,
      voices: sound.voices.map((item, index) => index === voiceIndex ? next : item),
    };
    onChange(nextSound);
    if (audition && selectedStep) void playSynthStep(nextSound, voiceIndex, selectedIndex);
  };

  const updateStepAt = (
    index: number,
    transform: (step: SynthStep) => SynthStep,
    audition = false,
  ) => {
    const current = voice.steps[index];
    if (!current) return;
    const nextVoice = {
      ...voice,
      steps: voice.steps.map((step, candidateIndex) => candidateIndex === index ? transform(step) : step),
    };
    const nextSound = {
      ...sound,
      voices: sound.voices.map((candidate, candidateIndex) => candidateIndex === voiceIndex ? nextVoice : candidate),
    };
    onChange(nextSound);
    if (audition) void playSynthStep(nextSound, voiceIndex, index);
  };

  const updateSelectedStep = (
    transform: (step: SynthStep) => SynthStep,
    audition = false,
  ) => updateStepAt(selectedIndex, transform, audition);

  const nudgePitch = (amount: number) => updateSelectedStep(
    (step) => ({ ...step, note: shiftedPitch(step.note, amount) }),
    true,
  );

  const setVolume = (value: number) => updateSelectedStep(
    (step) => ({ ...step, volume: clamp(value, 0, 1) }),
  );

  const beginPitchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!selectedStep) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pitchDrag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startIndex: pitchIndex(selectedStep.note),
      lastDelta: 0,
    };
  };

  const movePitchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pitchDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Up means higher pitch; down means lower pitch. One semitone per ~22 px.
    const delta = Math.round((drag.startY - event.clientY) / 22);
    if (delta === drag.lastDelta) return;
    drag.lastDelta = delta;
    const note = PITCHES[clamp(drag.startIndex + delta, 0, PITCHES.length - 1)];
    updateSelectedStep((step) => ({ ...step, note }), true);
  };

  const endPitchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pitchDrag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pitchDrag.current = null;
  };

  const pitchKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const amount = event.shiftKey ? 12 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      nudgePitch(-amount);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      nudgePitch(amount);
    }
  };

  return <div className="voice-editor">
    <div className="voice-settings">
      <div className="synth-wave-editor">
        <span>WAVE</span>
        <div className="synth-wave-options">
          {WAVEFORMS.map((waveform) => <button
            type="button"
            key={waveform.value}
            aria-pressed={voice.waveform === waveform.value}
            onClick={() => updateVoice({ ...voice, waveform: waveform.value }, true)}
          >[{waveform.label}]</button>)}
        </div>
      </div>
      <div className="synth-shape-editor">
        <span>SHAPE</span>
        <div className="synth-shape-options">
          {VOICE_SHAPES.map((shape) => <button
            type="button"
            key={shape.id}
            aria-pressed={voice.attack === shape.attack && voice.release === shape.release}
            onClick={() => updateVoice({ ...voice, attack: shape.attack, release: shape.release }, true)}
          >[{shape.label}]</button>)}
        </div>
      </div>
      <details className="synth-envelope-disclosure">
        <summary>EXACT ENVELOPE · A {voice.attack.toFixed(2)} · R {voice.release.toFixed(2)}</summary>
        <div className="synth-envelope-settings">
          <label>ATTACK
            <input type="number" step="0.01" min={0} max={1} value={voice.attack} onChange={(event) => updateVoice({ ...voice, attack: Number(event.target.value) })} />
          </label>
          <label>RELEASE
            <input type="number" step="0.01" min={0} max={1} value={voice.release} onChange={(event) => updateVoice({ ...voice, release: Number(event.target.value) })} />
          </label>
        </div>
      </details>
    </div>

    <div className="synth-step-pads" role="list" aria-label={`Voice ${voiceIndex + 1} sequence steps`}>
      {voice.steps.map((step, index) => <div
        className="synth-step-pad"
        data-active={step.active ? "true" : "false"}
        data-selected={selectedIndex === index ? "true" : "false"}
        role="listitem"
        key={index}
      >
        <button
          type="button"
          className="synth-step-select"
          aria-pressed={selectedIndex === index}
          aria-label={`Select step ${index + 1}, ${step.active ? "active" : "off"}, ${voice.waveform === "noise" ? "noise" : step.note}`}
          onClick={() => setStepIndex(index)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{voice.waveform === "noise" ? "NOISE" : step.note}</strong>
        </button>
        <button
          type="button"
          className="synth-step-toggle"
          aria-pressed={step.active}
          aria-label={`${step.active ? "Turn off" : "Turn on"} step ${index + 1}`}
          onClick={() => {
            setStepIndex(index);
            updateStepAt(index, (current) => ({ ...current, active: !current.active }), !step.active);
          }}
        >[{step.active ? "ON" : "OFF"}]</button>
      </div>)}
    </div>

    {selectedStep ? <section className="synth-step-editor" aria-label={`Edit step ${selectedIndex + 1}`}>
      <div className="synth-step-editor-heading">
        <strong>STEP {String(selectedIndex + 1).padStart(2, "0")}</strong>
        <span>{selectedStep.active ? "ACTIVE" : "OFF"}</span>
      </div>

      <div className="author-actions synth-selected-step-actions">
        <button
          type="button"
          aria-pressed={selectedStep.active}
          onClick={() => updateSelectedStep((step) => ({ ...step, active: !step.active }))}
        >[{selectedStep.active ? "ACTIVE ✓" : "ACTIVE ○"}]</button>
        <button type="button" onClick={() => void playSynthStep(sound, voiceIndex, selectedIndex)}>[AUDITION]</button>
      </div>

      {voice.waveform !== "noise" ? <div className="synth-pitch-editor">
        <span>PITCH</span>
        <button
          type="button"
          className="synth-pitch-scrub"
          aria-label={`Pitch ${selectedStep.note}. Drag up to raise pitch or down to lower pitch. Arrow keys change pitch; hold Shift for an octave.`}
          title="Drag up/down to scrub pitch"
          onPointerDown={beginPitchDrag}
          onPointerMove={movePitchDrag}
          onPointerUp={endPitchDrag}
          onPointerCancel={endPitchDrag}
          onKeyDown={pitchKey}
        >
          <strong>{selectedStep.note}</strong>
          <small>DRAG ↑↓</small>
        </button>
        <div className="synth-pitch-nudges">
          <button type="button" onClick={() => nudgePitch(-12)} aria-label="Pitch down one octave">[-12]</button>
          <button type="button" onClick={() => nudgePitch(-1)} aria-label="Pitch down one semitone">[-1]</button>
          <button type="button" onClick={() => nudgePitch(1)} aria-label="Pitch up one semitone">[+1]</button>
          <button type="button" onClick={() => nudgePitch(12)} aria-label="Pitch up one octave">[+12]</button>
        </div>
      </div> : <div className="synth-noise-step">NOISE VOICE · PITCH NOT USED</div>}

      <details className="synth-volume-disclosure">
        <summary>VOLUME {Math.round(selectedStep.volume * 100)}%</summary>
        <div className="synth-volume-editor">
          <div className="synth-volume-controls">
            <button
              type="button"
              onClick={() => setVolume(selectedStep.volume - 0.05)}
              aria-label="Volume down 5 percent"
            >[-5]</button>
            <input
              className="synth-volume-range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedStep.volume}
              aria-label={`Step ${selectedIndex + 1} volume`}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
            <button
              type="button"
              onClick={() => setVolume(selectedStep.volume + 0.05)}
              aria-label="Volume up 5 percent"
            >[+5]</button>
          </div>
          <small>Full-width touch rail · 1% steps · use ±5 for quick adjustments.</small>
        </div>
      </details>
    </section> : null}
  </div>;
}
