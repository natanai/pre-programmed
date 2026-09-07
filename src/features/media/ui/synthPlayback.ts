import type { SynthSound } from "../model";
import { noteFrequency, synthLoopCount, synthSequenceLength, validateSynth } from "../synth";
import { runningProceduralAudioContext, scheduleSynthVoice } from "./proceduralTone";

let activeStepPreview: { context: AudioContext; gain: GainNode } | null = null;

export type SynthPlaybackSession = {
  stop: () => void;
  finished: Promise<void>;
};

function releaseStepPreview() {
  const active = activeStepPreview;
  activeStepPreview = null;
  if (!active) return;
  const now = active.context.currentTime;
  active.gain.gain.cancelScheduledValues(now);
  active.gain.gain.setValueAtTime(Math.max(0, active.gain.gain.value), now);
  active.gain.gain.linearRampToValueAtTime(0, now + 0.015);
  window.setTimeout(() => {
    try { active.gain.disconnect(); } catch { /* already disconnected */ }
  }, 40);
}

/**
 * Play one complete Synth recipe. Looping is finite and recipe-owned; callers may
 * stop their own playback session without muting unrelated Synth effects.
 */
export async function playSynthSound(sound: SynthSound): Promise<SynthPlaybackSession | null> {
  if (validateSynth(sound).length) return null;
  const context = await runningProceduralAudioContext();
  if (!context) return null;

  const stepDuration = 60 / sound.tempo / 4;
  const sequenceDuration = synthSequenceLength(sound) * stepDuration;
  const totalPasses = synthLoopCount(sound);
  const destination = context.createGain();
  destination.gain.value = 1;
  destination.connect(context.destination);

  let completed = false;
  let timer: number | null = null;
  let resolveFinished: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });

  const disconnect = () => {
    try { destination.disconnect(); } catch { /* already disconnected */ }
  };

  const finishNaturally = () => {
    if (completed) return;
    completed = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    disconnect();
    resolveFinished();
  };

  const stop = () => {
    if (completed) return;
    completed = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    const now = context.currentTime;
    destination.gain.cancelScheduledValues(now);
    destination.gain.setValueAtTime(Math.max(0, destination.gain.value), now);
    destination.gain.linearRampToValueAtTime(0, now + 0.015);
    window.setTimeout(disconnect, 40);
    resolveFinished();
  };

  const schedulePass = (passIndex: number, requestedStart: number) => {
    if (completed) return;
    const passStart = Math.max(requestedStart, context.currentTime + 0.005);

    for (const voice of sound.voices) {
      voice.steps.forEach((step, index) => {
        if (!step.active) return;
        const stepStart = passStart + index * stepDuration;
        const frequency = voice.waveform === "noise" ? undefined : noteFrequency(step.note) || undefined;
        scheduleSynthVoice(context, destination, voice, stepStart, stepDuration, step.volume, frequency, step.bend ?? 0);
      });
    }

    const passEnd = passStart + sequenceDuration;
    if (passIndex + 1 >= totalPasses) {
      const delay = Math.max(0, (passEnd - context.currentTime) * 1000) + 25;
      timer = window.setTimeout(finishNaturally, delay);
      return;
    }

    // Queue the next pass shortly before its exact Web Audio start time. Keeping
    // only one pass ahead avoids creating thousands of oscillator nodes for a
    // long loop count while still preventing timer drift between repetitions.
    const lookAheadSeconds = Math.min(0.025, sequenceDuration / 2);
    const delay = Math.max(0, (passEnd - context.currentTime - lookAheadSeconds) * 1000);
    timer = window.setTimeout(() => schedulePass(passIndex + 1, passEnd), delay);
  };

  schedulePass(0, context.currentTime + 0.02);
  return { stop, finished };
}

/**
 * Audition one authored step without requiring it to be active in the sequence.
 * Rapid pitch scrubbing replaces the previous preview voice on Media's shared
 * AudioContext instead of creating one AudioContext per crossed semitone.
 */
export async function playSynthStep(sound: SynthSound, voiceIndex: number, stepIndex: number) {
  const voice = sound.voices[voiceIndex];
  const step = voice?.steps[stepIndex];
  if (!voice || !step) return;
  const context = await runningProceduralAudioContext();
  if (!context) return;

  releaseStepPreview();
  const destination = context.createGain();
  destination.gain.value = 1;
  destination.connect(context.destination);
  activeStepPreview = { context, gain: destination };

  const stepDuration = Math.max(0.08, 60 / Math.max(30, sound.tempo) / 4);
  const frequency = voice.waveform === "noise" ? undefined : noteFrequency(step.note) || undefined;
  scheduleSynthVoice(context, destination, voice, context.currentTime + 0.02, stepDuration, step.volume, frequency, step.bend ?? 0);
  window.setTimeout(() => {
    if (activeStepPreview?.gain === destination) activeStepPreview = null;
    try { destination.disconnect(); } catch { /* already replaced/disconnected */ }
  }, Math.ceil(stepDuration * 1000 + 80));
}
