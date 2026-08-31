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
