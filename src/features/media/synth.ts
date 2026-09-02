import type { SynthSound } from "./model";

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

export type SynthPresetId = "blip" | "chime" | "alert" | "hit";

const PRESETS: Record<SynthPresetId, Pick<SynthSound, "tempo" | "loop" | "voices">> = {
  blip: {
    tempo: 180,
    loop: false,
    voices: [{ waveform: "square", attack: 0.01, release: 0.08, steps: [
      { active: true, note: "C5", volume: 0.4 },
      { active: true, note: "G5", volume: 0.32 },
      { active: false, note: "C5", volume: 0.35 },
      { active: false, note: "C5", volume: 0.35 },
    ] }],
  },
  chime: {
    tempo: 150,
    loop: false,
    voices: [{ waveform: "sine", attack: 0.01, release: 0.32, steps: [
      { active: true, note: "C5", volume: 0.35 },
      { active: true, note: "E5", volume: 0.32 },
      { active: true, note: "G5", volume: 0.3 },
      { active: true, note: "C6", volume: 0.28 },
    ] }],
  },
  alert: {
    tempo: 210,
    loop: false,
    voices: [{ waveform: "square", attack: 0, release: 0.06, steps: [
      { active: true, note: "C5", volume: 0.4 },
      { active: true, note: "C6", volume: 0.4 },
      { active: true, note: "C5", volume: 0.4 },
      { active: true, note: "C6", volume: 0.4 },
    ] }],
  },
  hit: {
    tempo: 120,
    loop: false,
    voices: [{ waveform: "noise", attack: 0, release: 0.12, steps: [
      { active: true, note: "C4", volume: 0.5 },
      { active: false, note: "C4", volume: 0.35 },
      { active: false, note: "C4", volume: 0.35 },
      { active: false, note: "C4", volume: 0.35 },
    ] }],
  },
};

export function applySynthPreset(sound: SynthSound, preset: SynthPresetId): SynthSound {
  return { ...sound, ...structuredClone(PRESETS[preset]) };
}

/** A new sound is immediately audible and small enough to understand at a glance. */
export function createStarterSynth(id = crypto.randomUUID()): SynthSound {
  return {
    id,
    key: "new-sound",
    label: "New sound",
    ...structuredClone(PRESETS.blip),
  };
}
