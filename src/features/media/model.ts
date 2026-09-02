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

export type MediaAssetKind = "audio" | "image";

export type MediaAsset = {
  id: string;
  name: string;
  kind: MediaAssetKind;
  source: "embedded";
  dataUrl: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
};
