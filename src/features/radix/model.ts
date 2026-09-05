export type RadixSeedMode = "random" | "number" | "text";
export type RadixWidthMode = "viewport" | "terminal";
export type SortAlgorithm = "radix-lsd" | "quick" | "merge" | "heap" | "shell";

export type RadixSequenceDefinition = {
  id: string;
  label: string;
  caption: string;
  widthMode: RadixWidthMode;
  algorithm: SortAlgorithm;
  arraySize: number;
  radix: number;
  delayMs: number;
  finishHoldMs: number;
  seedMode: RadixSeedMode;
  seedValue: string;
  heightPx: number;
  showAlgorithmLabel: boolean;
  showStats: boolean;
  backgroundColor: string;
  barColor: string;
  accessColor: string;
  markerColor: string;
  soundEnabled: boolean;
  synthId: string;
  minFrequency: number;
  maxFrequency: number;
  volume: number;
  toneStride: number;
};

export type RadixStartupDefinition = {
  enabled: boolean;
  sequenceId: string;
};

export type RadixProjectSettings = {
  sequences: RadixSequenceDefinition[];
  startup: RadixStartupDefinition;
};

export const DEFAULT_RADIX_STARTUP: RadixStartupDefinition = {
  enabled: false,
  sequenceId: "",
};

export const SORT_ALGORITHM_LABELS: Record<SortAlgorithm, string> = {
  "radix-lsd": "Radix Sort (LSD)",
  quick: "Quick Sort",
  merge: "Merge Sort",
  heap: "Heap Sort",
  shell: "Shell Sort",
};

export function createRadixSequence(): RadixSequenceDefinition {
  return {
    id: crypto.randomUUID(),
    label: "Universe sort",
    caption: "loading universe",
    widthMode: "viewport",
    algorithm: "radix-lsd",
    arraySize: 256,
    radix: 4,
    delayMs: 2,
    finishHoldMs: 350,
    seedMode: "random",
    seedValue: "",
    heightPx: 360,
    showAlgorithmLabel: false,
    showStats: false,
    backgroundColor: "#000000",
    barColor: "#eeeeee",
    accessColor: "#ff2b1c",
    markerColor: "#18d7e8",
    soundEnabled: true,
    synthId: "",
    minFrequency: 120,
    maxFrequency: 1212,
    volume: 0.16,
    toneStride: 1,
  };
}
