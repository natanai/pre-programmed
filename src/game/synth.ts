import type { SynthSound, SynthVoice } from "./model";

const NOTE_PATTERN = /^([A-G])(#?)([2-7])$/;
const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteFrequency(note: string) {
  const match = note.match(NOTE_PATTERN);
  if (!match) return null;
  const midi = (Number(match[3]) + 1) * 12 + NOTE_OFFSETS[match[1]] + (match[2] ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

export function validateSynth(sound: SynthSound) {
  const errors: string[] = [];
  if (sound.voices.length > 4) errors.push("A synth sound may contain at most four voices.");
  if (sound.tempo < 30 || sound.tempo > 300) errors.push("Tempo must be between 30 and 300 BPM.");
  for (const voice of sound.voices) {
    if (voice.steps.length > 16) errors.push("A voice may contain at most sixteen steps.");
    for (const step of voice.steps) {
      if (step.active && voice.waveform !== "noise" && noteFrequency(step.note) === null) {
        errors.push(`Invalid note ${step.note}.`);
      }
      if (step.volume < 0 || step.volume > 1) errors.push("Step volume must be between 0 and 1.");
    }
  }
  return errors;
}

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

export function createSilentSynth(id = crypto.randomUUID()): SynthSound {
  return {
    id,
    key: "new-sound",
    label: "New sound",
    tempo: 120,
    loop: false,
    voices: ["square", "triangle", "sawtooth", "noise"].map((waveform) => ({
      waveform: waveform as SynthVoice["waveform"],
      attack: 0.01,
      release: 0.04,
      steps: Array.from({ length: 16 }, () => ({ active: false, note: "C4", volume: 0.35 })),
    })),
  };
}
