import type { SynthSound } from "../model";
import { noteFrequency, validateSynth } from "../synth";
import { runningProceduralAudioContext, scheduleSynthVoice } from "./proceduralTone";

let activeStepPreview: { context: AudioContext; gain: GainNode } | null = null;

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

export async function playSynthSound(sound: SynthSound) {
  if (validateSynth(sound).length) return;
  const context = await runningProceduralAudioContext();
  if (!context) return;
  const stepDuration = 60 / sound.tempo / 4;
  const start = context.currentTime + 0.02;
  for (const voice of sound.voices) {
    voice.steps.forEach((step, index) => {
      if (!step.active) return;
      const stepStart = start + index * stepDuration;
      const frequency = voice.waveform === "noise" ? undefined : noteFrequency(step.note) || undefined;
      scheduleSynthVoice(context, context.destination, voice, stepStart, stepDuration, step.volume, frequency, step.bend ?? 0);
    });
  }
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
