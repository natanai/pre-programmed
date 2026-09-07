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
  MAX_SYNTH_LOOP_COUNT,
  MAX_SYNTH_STEPS,
  MAX_SYNTH_VOICES,
  MIN_SYNTH_LOOP_COUNT,
  removeSynthVoice,
  resizeSynthSequence,
  synthSequenceLength,
} from "../synth";
import { playSynthSound, playSynthStep, type SynthPlaybackSession } from "../ui/synthPlayback";
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

const GESTURE_DEAD_ZONE = 12;
const PITCH_PIXELS_PER_SEMITONE = 18;
const BEND_PIXELS_PER_SEMITONE = 26;
const MAX_DIRECT_BEND = 7;

type StepGesture = {
  pointerId: number;
  index: number;
  startX: number;
  startY: number;
  startPitchIndex: number;
  startBend: number;
  lastPitchIndex: number;
  lastBend: number;
  axis: "pitch" | "bend" | null;
  moved: boolean;
};

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

function envelopePosition(seconds: number) {
  return Math.round(Math.sqrt(clamp(seconds, 0, 1)) * 100);
}

function envelopeSeconds(position: number) {
  return Number(((clamp(position, 0, 100) / 100) ** 2).toFixed(3));
}

function envelopeLabel(seconds: number) {
  return `${Math.round(seconds * 1000)}ms`;
}

function bendLabel(bend = 0) {
  if (!bend) return "";
  return bend > 0 ? `↗${bend}` : `↘${Math.abs(bend)}`;
}

/**
 * Media-owned tactile Synth workbench used inside the shared structured Author task.
 * The owning workspace keeps draft/save/delete semantics; this control only edits
 * that one live Synth draft and uses Media's existing playback contract.
 */
export function SynthSequencer({ sound, onChange }: {
  sound: SynthSound;
  onChange: (sound: SynthSound) => void;
}) {
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<SynthPlaybackSession | null>(null);
  const playbackRequest = useRef(0);
  const loopCount = sound.loopCount ?? MIN_SYNTH_LOOP_COUNT;

  useEffect(() => {
    setVoiceIndex((current) => Math.max(0, Math.min(current, sound.voices.length - 1)));
  }, [sound.voices.length]);

  useEffect(() => () => {
    playbackRequest.current += 1;
    playbackRef.current?.stop();
    playbackRef.current = null;
  }, []);

  const setTempo = (tempo: number) => {
    if (!Number.isFinite(tempo)) return;
    onChange({ ...sound, tempo: clamp(Math.round(tempo), 30, 300) });
  };

  const setLoopCount = (count: number) => {
    if (!Number.isFinite(count)) return;
    onChange({
      ...sound,
      loop: true,
      loopCount: clamp(Math.round(count), MIN_SYNTH_LOOP_COUNT, MAX_SYNTH_LOOP_COUNT),
    });
  };

  const toggleLoop = () => {
    onChange({
      ...sound,
      loop: !sound.loop,
      ...(sound.loop ? {} : { loopCount }),
    });
  };

  const stopPlayback = () => {
    playbackRequest.current += 1;
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  };

  const play = async () => {
    stopPlayback();
    const request = playbackRequest.current;
    const session = await playSynthSound(sound);
    if (!session) return;
    if (request !== playbackRequest.current) {
      session.stop();
      return;
    }
    playbackRef.current = session;
    setIsPlaying(true);
    await session.finished;
    if (request === playbackRequest.current && playbackRef.current === session) {
      playbackRef.current = null;
      setIsPlaying(false);
    }
  };

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
    <div className="synth-transport" role="group" aria-label="Synth transport and tempo">
      <button
        type="button"
        className="synth-play"
        aria-label={isPlaying ? "Stop Synth preview" : "Play Synth preview"}
        onClick={isPlaying ? stopPlayback : () => { void play(); }}
      >{isPlaying ? "[■ STOP]" : "[▶ PLAY]"}</button>
      <div className="synth-tempo-control">
        <span>BPM</span>
        <button type="button" onClick={() => setTempo(sound.tempo - 5)} aria-label="Decrease tempo by 5 BPM">[-5]</button>
        <input
          type="number"
          min={30}
          max={300}
          step={1}
          inputMode="numeric"
          aria-label="Synth tempo in beats per minute. Drag horizontally on touch devices or enter a number."
          value={sound.tempo}
          onChange={(event) => setTempo(Number(event.target.value))}
        />
        <button type="button" onClick={() => setTempo(sound.tempo + 5)} aria-label="Increase tempo by 5 BPM">[+5]</button>
      </div>
      <button
        type="button"
        className="synth-loop-toggle"
        aria-pressed={sound.loop}
        onClick={toggleLoop}
      >[{sound.loop ? "LOOP ✓" : "LOOP ○"}]</button>
      {sound.loop ? <div className="synth-tempo-control" role="group" aria-label="Total Synth loop plays">
        <span>PLAYS</span>
        <button
          type="button"
          disabled={loopCount <= MIN_SYNTH_LOOP_COUNT}
          onClick={() => setLoopCount(loopCount - 1)}
          aria-label="Decrease total loop plays"
        >[-]</button>
        <input
          type="number"
          min={MIN_SYNTH_LOOP_COUNT}
          max={MAX_SYNTH_LOOP_COUNT}
          step={1}
          inputMode="numeric"
          aria-label={`Total Synth plays while looping, from ${MIN_SYNTH_LOOP_COUNT} to ${MAX_SYNTH_LOOP_COUNT}`}
          value={loopCount}
          onChange={(event) => setLoopCount(Number(event.target.value))}
        />
        <button
          type="button"
          disabled={loopCount >= MAX_SYNTH_LOOP_COUNT}
          onClick={() => setLoopCount(loopCount + 1)}
          aria-label="Increase total loop plays"
        >[+]</button>
      </div> : null}
    </div>

    <div className="synth-voice-strip">
      <nav className="voice-tabs" aria-label="Synth voices">
        {sound.voices.map((voice, index) => <button
          type="button"
          aria-pressed={voiceIndex === index}
          key={index}
          onClick={() => setVoiceIndex(index)}
        >[V{index + 1} {voice.waveform}]</button>)}
      </nav>
      <div className="author-actions synth-voice-actions">
        <button type="button" disabled={sound.voices.length >= MAX_SYNTH_VOICES} onClick={addVoice}>[+ VOICE]</button>
        <button type="button" disabled={sound.voices.length >= MAX_SYNTH_VOICES} onClick={duplicateVoice}>[DUP]</button>
        <button type="button" disabled={sound.voices.length <= 1} onClick={removeVoice}>[- VOICE]</button>
      </div>
    </div>

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
  const sequenceLength = synthSequenceLength(sound);
  const [detailStepIndex, setDetailStepIndex] = useState(0);
  const stepGesture = useRef<StepGesture | null>(null);

  useEffect(() => {
    setDetailStepIndex(0);
  }, [voiceIndex]);

  useEffect(() => {
    setDetailStepIndex((current) => Math.max(0, Math.min(current, voice.steps.length - 1)));
  }, [voice.steps.length]);

  const selectedIndex = Math.max(0, Math.min(detailStepIndex, voice.steps.length - 1));
  const selectedStep = voice.steps[selectedIndex];

  const updateVoice = (next: typeof voice, audition = false) => {
    const nextSound = {
      ...sound,
      voices: sound.voices.map((item, index) => index === voiceIndex ? next : item),
    };
    onChange(nextSound);
    if (audition && next.steps[selectedIndex]) void playSynthStep(nextSound, voiceIndex, selectedIndex);
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

  const toggleStep = (index: number) => {
    const step = voice.steps[index];
    if (!step) return;
    setDetailStepIndex(index);
    updateStepAt(index, (current) => ({ ...current, active: !current.active }), !step.active);
  };

  const setVolume = (value: number) => {
    if (!selectedStep) return;
    updateStepAt(selectedIndex, (step) => ({ ...step, volume: clamp(value, 0, 1) }));
  };

  const setEnvelope = (kind: "attack" | "release", position: number) => {
    updateVoice({ ...voice, [kind]: envelopeSeconds(position) });
  };

  const beginStepGesture = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    setDetailStepIndex(index);
    if (voice.waveform === "noise" || !event.isPrimary) return;
    const step = voice.steps[index];
    if (!step) return;
    event.preventDefault();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is only an enhancement */ }
    stepGesture.current = {
      pointerId: event.pointerId,
      index,
      startX: event.clientX,
      startY: event.clientY,
      startPitchIndex: pitchIndex(step.note),
      startBend: step.bend ?? 0,
      lastPitchIndex: pitchIndex(step.note),
      lastBend: step.bend ?? 0,
      axis: null,
      moved: false,
    };
  };

  const moveStepGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = stepGesture.current;
    if (!drag || drag.pointerId !== event.pointerId || voice.waveform === "noise") return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!drag.axis) {
      const distance = Math.max(absX, absY);
      if (distance < GESTURE_DEAD_ZONE) return;
      if (absY > absX * 1.2) drag.axis = "pitch";
      else if (absX > absY * 1.2) drag.axis = "bend";
      else if (distance >= GESTURE_DEAD_ZONE + 8) drag.axis = absY >= absX ? "pitch" : "bend";
      else return;
      drag.moved = true;
    }

    if (drag.axis === "pitch") {
      const delta = Math.round(-dy / PITCH_PIXELS_PER_SEMITONE);
      const nextIndex = clamp(drag.startPitchIndex + delta, 0, PITCHES.length - 1);
      if (nextIndex === drag.lastPitchIndex) return;
      drag.lastPitchIndex = nextIndex;
      updateStepAt(drag.index, (step) => ({ ...step, active: true, note: PITCHES[nextIndex] }), true);
      return;
    }

    const delta = Math.round(dx / BEND_PIXELS_PER_SEMITONE);
    const nextBend = Math.round(clamp(drag.startBend + delta, -MAX_DIRECT_BEND, MAX_DIRECT_BEND));
    if (nextBend === drag.lastBend) return;
    drag.lastBend = nextBend;
    updateStepAt(drag.index, (step) => ({ ...step, active: true, bend: nextBend }), true);
  };

  const finishStepGesture = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = stepGesture.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* Safari may release capture first */ }
    stepGesture.current = null;
    if (!cancelled && !drag.moved) toggleStep(drag.index);
  };

  const stepKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (voice.waveform === "noise") return;
    const step = voice.steps[index];
    if (!step) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      setDetailStepIndex(index);
      const amount = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 12 : 1);
      updateStepAt(index, (current) => ({ ...current, active: true, note: shiftedPitch(current.note, amount) }), true);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setDetailStepIndex(index);
      const amount = event.key === "ArrowRight" ? 1 : -1;
      updateStepAt(index, (current) => ({
        ...current,
        active: true,
        bend: Math.round(clamp((current.bend ?? 0) + amount, -MAX_DIRECT_BEND, MAX_DIRECT_BEND)),
      }), true);
    }
  };

  return <div className="synth-workbench-grid">
    <section className="synth-patch-panel" aria-label={`Voice ${voiceIndex + 1} patch`}>
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

      <div className="synth-envelope-editor">
        <div className="synth-envelope-heading">
          <span>ENVELOPE</span>
          <small>A {envelopeLabel(voice.attack)} · R {envelopeLabel(voice.release)}</small>
        </div>
        <label className="synth-envelope-rail">
          <span>ATTACK <strong>{envelopeLabel(voice.attack)}</strong></span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={envelopePosition(voice.attack)}
            aria-label={`Attack ${envelopeLabel(voice.attack)}. The rail gives extra precision to short attacks.`}
            onChange={(event) => setEnvelope("attack", Number(event.target.value))}
          />
        </label>
        <label className="synth-envelope-rail">
          <span>RELEASE <strong>{envelopeLabel(voice.release)}</strong></span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={envelopePosition(voice.release)}
            aria-label={`Release ${envelopeLabel(voice.release)}. The rail gives extra precision to short releases.`}
            onChange={(event) => setEnvelope("release", Number(event.target.value))}
          />
        </label>
        <small className="synth-envelope-help">Short envelope times get more rail space, so tiny retro clicks and bleeps are easier to shape.</small>
      </div>
    </section>

    <section className="synth-sequence-panel" aria-label={`Voice ${voiceIndex + 1} sequence`}>
      <div className="synth-sequence-heading">
        <div>
          <strong>SEQUENCE {String(sequenceLength).padStart(2, "0")}</strong>
          <small>{voice.waveform === "noise" ? "tap beats on/off" : "tap on/off · drag ↑↓ note · drag ←→ sweep"}</small>
        </div>
        <div className="synth-length-actions" role="group" aria-label="Sequence length">
          <button
            type="button"
            disabled={sequenceLength <= 1}
            onClick={() => onChange(resizeSynthSequence(sound, sequenceLength - 1))}
            aria-label="Remove one beat from every voice"
          >[-]</button>
          <button
            type="button"
            disabled={sequenceLength >= MAX_SYNTH_STEPS}
            onClick={() => onChange(resizeSynthSequence(sound, sequenceLength + 1))}
            aria-label="Add one beat to every voice"
          >[+]</button>
        </div>
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
            className="synth-step-direct"
            aria-pressed={step.active}
            aria-label={voice.waveform === "noise"
              ? `Step ${index + 1}, noise, ${step.active ? "on" : "off"}. Tap to toggle.`
              : `Step ${index + 1}, ${step.note}${step.bend ? `, pitch sweep ${step.bend > 0 ? "up" : "down"} ${Math.abs(step.bend)} semitones` : ""}, ${step.active ? "on" : "off"}. Tap to toggle, drag vertically for note, horizontally for pitch sweep.`}
            title={voice.waveform === "noise" ? "Tap on/off" : "Tap on/off · drag ↑↓ note · drag ←→ sweep"}
            onPointerDown={(event) => beginStepGesture(event, index)}
            onPointerMove={moveStepGesture}
            onPointerUp={(event) => finishStepGesture(event)}
            onPointerCancel={(event) => finishStepGesture(event, true)}
            onKeyDown={(event) => stepKey(event, index)}
            onClick={(event) => {
              if (voice.waveform !== "noise" && event.detail !== 0) return;
              toggleStep(index);
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{voice.waveform === "noise" ? "NOISE" : step.note}</strong>
            <small>{voice.waveform === "noise" ? (step.active ? "ON" : "OFF") : bendLabel(step.bend) || (step.active ? "ON" : "OFF")}</small>
          </button>
        </div>)}
      </div>

      {selectedStep ? <details className="synth-step-details">
        <summary>STEP {String(selectedIndex + 1).padStart(2, "0")} DETAILS · VOLUME {Math.round(selectedStep.volume * 100)}%</summary>
        <div className="synth-step-details-body">
          <div className="author-actions synth-step-detail-actions">
            <button type="button" onClick={() => void playSynthStep(sound, voiceIndex, selectedIndex)}>[AUDITION]</button>
            {voice.waveform !== "noise" && (selectedStep.bend ?? 0) !== 0
              ? <button type="button" onClick={() => updateStepAt(selectedIndex, (step) => ({ ...step, bend: 0 }), true)}>[CLEAR SWEEP]</button>
              : null}
          </div>
          <div className="synth-volume-controls">
            <button type="button" onClick={() => setVolume(selectedStep.volume - 0.05)} aria-label="Volume down 5 percent">[-5]</button>
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
            <button type="button" onClick={() => setVolume(selectedStep.volume + 0.05)} aria-label="Volume up 5 percent">[+5]</button>
          </div>
        </div>
      </details> : null}
    </section>
  </div>;
}
