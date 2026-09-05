import type { SynthSound } from "../model";

let sharedContext: AudioContext | null = null;

function audioContext() {
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new AudioContext();
  return sharedContext;
}

export async function unlockProceduralAudio() {
  const context = audioContext();
  if (context.state === "suspended") {
    try { await context.resume(); } catch { /* browser gesture policy: a later gesture may resume it */ }
  }
}

export type ProceduralToneSession = {
  tone: (frequency: number) => void;
  stop: () => void;
};

/**
 * Procedural consumers share Media's synth vocabulary instead of owning another
 * oscillator implementation. The first non-noise synth voice acts as the patch;
 * sequence notes remain the responsibility of Tiny Synth playback.
 */
export async function createProceduralToneSession(
  sound: SynthSound | undefined,
  volume: number,
): Promise<ProceduralToneSession | null> {
  const context = audioContext();
  if (context.state === "suspended") {
    try { await context.resume(); } catch { return null; }
  }
  if (context.state !== "running") return null;

  const selected = sound?.voices.find((voice) => voice.waveform !== "noise") ?? sound?.voices[0];
  const waveform = selected && selected.waveform !== "noise" ? selected.waveform : "triangle";
  const attack = Math.max(0.001, selected?.attack ?? 0.003);
  const release = Math.max(0.003, selected?.release ?? 0.018);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const targetVolume = Math.max(0, Math.min(1, volume));

  oscillator.type = waveform;
  oscillator.frequency.value = 220;
  gain.gain.value = 0;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  let stopped = false;

  return {
    tone(frequency) {
      if (stopped || !Number.isFinite(frequency) || frequency <= 0) return;
      const now = context.currentTime;
      oscillator.frequency.setTargetAtTime(frequency, now, 0.0015);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(targetVolume, now + attack);
      gain.gain.setTargetAtTime(0, now + attack, release);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, release);
      oscillator.stop(now + Math.max(0.03, release * 6));
    },
  };
}
