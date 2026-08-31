import type { SynthSound, SynthVoice } from "../model";
import { noteFrequency, validateSynth } from "../synth";

function scheduleNoise(
  context: AudioContext,
  destination: AudioNode,
  voice: SynthVoice,
  start: number,
  duration: number,
  volume: number,
) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.connect(gain).connect(destination);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + voice.attack);
  gain.gain.setValueAtTime(volume, Math.max(start + voice.attack, start + duration - voice.release));
  gain.gain.linearRampToValueAtTime(0, start + duration);
  source.start(start);
}

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
      if (voice.waveform === "noise") {
        scheduleNoise(context, context.destination, voice, stepStart, stepDuration, step.volume);
        return;
      }
      const frequency = noteFrequency(step.note);
      if (!frequency) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = voice.waveform;
      oscillator.frequency.value = frequency;
      oscillator.connect(gain).connect(context.destination);
      gain.gain.setValueAtTime(0, stepStart);
      gain.gain.linearRampToValueAtTime(step.volume, stepStart + voice.attack);
      gain.gain.setValueAtTime(
        step.volume,
        Math.max(stepStart + voice.attack, stepStart + stepDuration - voice.release),
      );
      gain.gain.linearRampToValueAtTime(0, stepStart + stepDuration);
      oscillator.start(stepStart);
      oscillator.stop(stepStart + stepDuration + 0.01);
    });
  }
  window.setTimeout(() => void context.close(), Math.ceil(maximumSteps * stepDuration * 1000 + 500));
}
