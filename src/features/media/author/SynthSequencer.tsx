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
  const pitchDrag = useRef<{ pointerId: number; startX: number; startIndex: number; lastDelta: number } | null>(null);
  const volumePointer = useRef<number | null>(null);

  useEffect(() => {
    setStepIndex(0);
  }, [voiceIndex]);

  useEffect(() => {
    setStepIndex((current) => Math.max(0, Math.min(current, voice.steps.length - 1)));
  }, [voice.steps.length]);

  const selectedIndex = Math.max(0, Math.min(stepIndex, voice.steps.length - 1));
  const selectedStep = voice.steps[selectedIndex];

  const updateVoice = (next: typeof voice) => onChange({
    ...sound,
    voices: sound.voices.map((item, index) => index === voiceIndex ? next : item),
  });

  const updateSelectedStep = (
    transform: (step: SynthStep) => SynthStep,
    audition = false,
  ) => {
    const current = voice.steps[selectedIndex];
    if (!current) return;
    const nextVoice = {
      ...voice,
      steps: voice.steps.map((step, index) => index === selectedIndex ? transform(step) : step),
    };
    const nextSound = {
      ...sound,
      voices: sound.voices.map((candidate, index) => index === voiceIndex ? nextVoice : candidate),
    };
    onChange(nextSound);
    if (audition) void playSynthStep(nextSound, voiceIndex, selectedIndex);
  };

  const nudgePitch = (amount: number) => updateSelectedStep(
    (step) => ({ ...step, note: shiftedPitch(step.note, amount) }),
    true,
  );

  const setVolume = (value: number, audition = false) => updateSelectedStep(
    (step) => ({ ...step, volume: clamp(value, 0, 1) }),
    audition,
  );

  const beginPitchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!selectedStep) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pitchDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: pitchIndex(selectedStep.note),
      lastDelta: 0,
    };
  };

  const movePitchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pitchDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = Math.round((event.clientX - drag.startX) / 18);
    if (delta === drag.lastDelta) return;
    drag.lastDelta = delta;
    const note = PITCHES[clamp(drag.startIndex + delta, 0, PITCHES.length - 1)];
    updateSelectedStep((step) => ({ ...step, note }));
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

  const volumeFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    setVolume((event.clientX - rect.left) / rect.width);
  };

  const beginVolume = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    volumePointer.current = event.pointerId;
    volumeFromPointer(event);
  };

  const moveVolume = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (volumePointer.current !== event.pointerId) return;
    volumeFromPointer(event);
  };

  const endVolume = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (volumePointer.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    volumePointer.current = null;
  };

  const volumeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selectedStep) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      setVolume(selectedStep.volume - 0.05, true);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      setVolume(selectedStep.volume + 0.05, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      setVolume(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      setVolume(1, true);
    }
  };

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

    <div className="synth-step-pads" role="list" aria-label={`Voice ${voiceIndex + 1} sequence steps`}>
      {voice.steps.map((step, index) => <button
        type="button"
        role="listitem"
        className="synth-step-pad"
        data-active={step.active ? "true" : "false"}
        aria-pressed={selectedIndex === index}
        aria-label={`Step ${index + 1}, ${step.active ? "active" : "off"}, ${voice.waveform === "noise" ? "noise" : step.note}, volume ${Math.round(step.volume * 100)} percent`}
        key={index}
        onClick={() => setStepIndex(index)}
      >
        <span>{String(index + 1).padStart(2, "0")} {step.active ? "●" : "○"}</span>
        <strong>{voice.waveform === "noise" ? "NOISE" : step.note}</strong>
        <small>{Math.round(step.volume * 100)}%</small>
      </button>)}
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
        <div className="synth-pitch-controls">
          <button type="button" onClick={() => nudgePitch(-12)} aria-label="Pitch down one octave">[-12]</button>
          <button type="button" onClick={() => nudgePitch(-1)} aria-label="Pitch down one semitone">[-1]</button>
          <button
            type="button"
            className="synth-pitch-scrub"
            aria-label={`Pitch ${selectedStep.note}. Drag left or right, or use arrow keys, to change pitch.`}
            title="Drag left/right to scrub pitch"
            onPointerDown={beginPitchDrag}
            onPointerMove={movePitchDrag}
            onPointerUp={endPitchDrag}
            onPointerCancel={endPitchDrag}
            onKeyDown={pitchKey}
          >{selectedStep.note}</button>
          <button type="button" onClick={() => nudgePitch(1)} aria-label="Pitch up one semitone">[+1]</button>
          <button type="button" onClick={() => nudgePitch(12)} aria-label="Pitch up one octave">[+12]</button>
        </div>
      </div> : <div className="synth-noise-step">NOISE VOICE · PITCH NOT USED</div>}

      <div className="synth-volume-editor">
        <span>VOLUME</span>
        <div className="synth-volume-controls">
          <button type="button" onClick={() => setVolume(selectedStep.volume - 0.05, true)} aria-label="Volume down 5 percent">[-5]</button>
          <div
            className="synth-volume-pad"
            role="slider"
            tabIndex={0}
            aria-label={`Step ${selectedIndex + 1} volume`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(selectedStep.volume * 100)}
            onPointerDown={beginVolume}
            onPointerMove={moveVolume}
            onPointerUp={endVolume}
            onPointerCancel={endVolume}
            onKeyDown={volumeKey}
          >
            <span className="synth-volume-fill" style={{ width: `${Math.round(selectedStep.volume * 100)}%` }} />
            <strong>VOL {Math.round(selectedStep.volume * 100)}%</strong>
          </div>
          <button type="button" onClick={() => setVolume(selectedStep.volume + 0.05, true)} aria-label="Volume up 5 percent">[+5]</button>
        </div>
      </div>
    </section> : null}
  </div>;
}
