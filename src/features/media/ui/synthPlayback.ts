import type { SynthSound } from "../model";
import { noteFrequency, validateSynth } from "../synth";
import { scheduleSynthVoice } from "./proceduralTone";

export async function playSynthSound(sound: SynthSound) {
  if (validateSynth(sound).length) return;
  const context = new AudioContext();
  const stepDuration = 60 / sound.tempo / 4;
  const start = context.currentTime + 0.02;
  let maximumSteps = 0;
  for (const voice of sound.voices) {
    maximumSteps = Math.max(maximumSteps, voice.steps.length);
    voice.steps.forEach((step, index) => {
      if (!step.active) return;
      const stepStart = start + index * stepDuration;
      const frequency = voice.waveform === "noise" ? undefined : noteFrequency(step.note) || undefined;
      scheduleSynthVoice(context, context.destination, voice, stepStart, stepDuration, step.volume, frequency);
    });
  }
  window.setTimeout(() => void context.close(), Math.ceil(maximumSteps * stepDuration * 1000 + 500));
}

/** Audition one authored step without requiring it to be active in the sequence. */
export async function playSynthStep(sound: SynthSound, voiceIndex: number, stepIndex: number) {
  const voice = sound.voices[voiceIndex];
  const step = voice?.steps[stepIndex];
  if (!voice || !step) return;
  const context = new AudioContext();
  const stepDuration = Math.max(0.08, 60 / Math.max(30, sound.tempo) / 4);
  const frequency = voice.waveform === "noise" ? undefined : noteFrequency(step.note) || undefined;
  scheduleSynthVoice(context, context.destination, voice, context.currentTime + 0.02, stepDuration, step.volume, frequency);
  window.setTimeout(() => void context.close(), Math.ceil(stepDuration * 1000 + 500));
}
