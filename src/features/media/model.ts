export type SynthStep = {
  active: boolean;
  note: string;
  volume: number;
};

export type SynthVoice = {
  waveform: "square" | "triangle" | "sawtooth" | "sine" | "noise";
  attack: number;
  release: number;
  steps: SynthStep[];
};

export type SynthSound = {
  id: string;
  key: string;
  label: string;
  tempo: number;
  loop: boolean;
  voices: SynthVoice[];
};
