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
