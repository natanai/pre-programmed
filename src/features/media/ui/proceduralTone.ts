import type { SynthSound, SynthVoice } from "../model";

let sharedContext: AudioContext | null = null;
let primedContext: AudioContext | null = null;

function audioContext() {
  if (!sharedContext || sharedContext.state === "closed") sharedContext = new AudioContext();
  return sharedContext;
}

function primeRunningContext(context: AudioContext) {
  if (primedContext === context) return;
  const gain = context.createGain();
  gain.gain.value = 0;
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 220;
  oscillator.connect(gain).connect(context.destination);
  const now = context.currentTime;
  oscillator.start(now);
  oscillator.stop(now + 0.02);
  primedContext = context;
}

export function scheduleSynthVoice(
  context: AudioContext,
  destination: AudioNode,
  voice: SynthVoice,
  start: number,
  duration: number,
  volume: number,
  frequency?: number,
) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + voice.attack);
  gain.gain.setValueAtTime(volume, Math.max(start + voice.attack, start + duration - voice.release));
  gain.gain.linearRampToValueAtTime(0, start + duration);

  if (voice.waveform === "noise") {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(destination);
    source.start(start);
    return;
  }

  if (!frequency || !Number.isFinite(frequency) || frequency <= 0) return;
  const oscillator = context.createOscillator();
  oscillator.type = voice.waveform;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

export function proceduralAudioReady() {
  return sharedContext?.state === "running";
}

/**
 * Must be called from a player gesture when reliable browser audio is required.
 * A silent oscillator primes Safari/WebKit's output path without producing an
 * audible boot sound of its own.
 */
export async function unlockProceduralAudio() {
  const context = audioContext();
  if (context.state === "suspended") {
    try { await context.resume(); } catch { /* browser gesture policy: a later gesture may resume it */ }
  }
  if (context.state === "running") primeRunningContext(context);
  return context.state === "running";
}

export type ProceduralToneSession = {
  tone: (frequency: number) => void;
  stop: () => void;
};

/**
 * Procedural consumers share Media's synth vocabulary instead of owning another
 * sound system. The first pitched synth voice acts as the procedural patch;
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
