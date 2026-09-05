import {
  DEFAULT_RADIX_STARTUP,
  type RadixProjectSettings,
  type RadixSequenceDefinition,
} from "./model";

export type RadixProjectSettingsSlice = {
  radix: RadixProjectSettings;
};

export const DEFAULT_RADIX_PROJECT_SETTINGS: RadixProjectSettingsSlice = {
  radix: {
    sequences: [],
    startup: structuredClone(DEFAULT_RADIX_STARTUP),
  },
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function normalizeSequence(value: unknown): RadixSequenceDefinition | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id) return null;
  return {
    id: item.id,
    label: typeof item.label === "string" && item.label.trim() ? item.label : "Radix sequence",
    caption: typeof item.caption === "string" ? item.caption : "loading universe",
    widthMode: item.widthMode === "terminal" ? "terminal" : "viewport",
    arraySize: Math.round(boundedNumber(item.arraySize, 256, 8, 1024)),
    radix: Math.round(boundedNumber(item.radix, 4, 2, 16)),
    delayMs: boundedNumber(item.delayMs, 2, 0, 250),
    finishHoldMs: boundedNumber(item.finishHoldMs, 350, 0, 10000),
    seedMode: item.seedMode === "number" || item.seedMode === "text" ? item.seedMode : "random",
    seedValue: typeof item.seedValue === "string" ? item.seedValue : "",
    heightPx: Math.round(boundedNumber(item.heightPx, 360, 96, 1200)),
    showAlgorithmLabel: item.showAlgorithmLabel === true,
    showStats: item.showStats === true,
    backgroundColor: color(item.backgroundColor, "#000000"),
    barColor: color(item.barColor, "#eeeeee"),
    accessColor: color(item.accessColor, "#ff2b1c"),
    markerColor: color(item.markerColor, "#18d7e8"),
    soundEnabled: item.soundEnabled !== false,
    synthId: typeof item.synthId === "string" ? item.synthId : "",
    minFrequency: boundedNumber(item.minFrequency, 120, 20, 12000),
    maxFrequency: boundedNumber(item.maxFrequency, 1212, 20, 16000),
    volume: boundedNumber(item.volume, 0.16, 0, 1),
    toneStride: Math.round(boundedNumber(item.toneStride, 1, 1, 64)),
  };
}

export function normalizeRadixProjectSettings(root: Record<string, unknown>): RadixProjectSettingsSlice {
  const raw = root.radix && typeof root.radix === "object" ? root.radix as Record<string, unknown> : {};
  const sequences = Array.isArray(raw.sequences)
    ? raw.sequences.map(normalizeSequence).filter((value): value is RadixSequenceDefinition => Boolean(value))
    : [];
  const startupValue = raw.startup && typeof raw.startup === "object" ? raw.startup as Record<string, unknown> : {};
  return {
    radix: {
      sequences,
      startup: {
        enabled: startupValue.enabled === true,
        sequenceId: typeof startupValue.sequenceId === "string" ? startupValue.sequenceId : "",
      },
    },
  };
}
