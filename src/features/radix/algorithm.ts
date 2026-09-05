import type { RadixSequenceDefinition } from "./model";

export type RadixSortEvent =
  | { type: "access"; index: number; value: number; accesses: number }
  | { type: "write"; index: number; value: number; accesses: number }
  | { type: "markers"; indexes: number[]; accesses: number }
  | { type: "pass"; digit: number; accesses: number }
  | { type: "complete"; accesses: number };

function hashText(text: string) {
  let hash = 2166136261 >>> 0;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 1;
}

function randomSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
}

export function resolveRadixSeed(sequence: RadixSequenceDefinition, runtimeSeed?: number) {
  if (sequence.seedMode === "text") return hashText(sequence.seedValue);
  if (sequence.seedMode === "number") {
    const parsed = Number(sequence.seedValue);
    return Number.isFinite(parsed) ? (Math.trunc(parsed) >>> 0) || 1 : hashText(sequence.seedValue);
  }
  return runtimeSeed || randomSeed();
}

function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function createSeededArray(size: number, seed: number) {
  const values = Array.from({ length: size }, (_, index) => index + 1);
  const random = seededRandom(seed);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

/**
 * Independently implemented stable LSD radix sort. The algorithm emits semantic
 * operations; browser rendering and sound remain separate consumers.
 */
export function radixSortEvents(initial: readonly number[], radix: number) {
  const array = [...initial];
  const events: RadixSortEvent[] = [];
  let accesses = 0;
  const maximum = Math.max(...array, 0);
  let divisor = 1;
  let digit = 0;

  while (Math.floor(maximum / divisor) > 0) {
    const buckets = Array.from({ length: radix }, () => [] as number[]);

    for (let index = 0; index < array.length; index += 1) {
      const value = array[index];
      accesses += 1;
      events.push({ type: "access", index, value, accesses });
      const bucket = Math.floor(value / divisor) % radix;
      buckets[bucket].push(value);
    }

    let cursor = 0;
    const markers: number[] = [];
    for (let bucket = 0; bucket < radix; bucket += 1) {
      markers.push(cursor);
      events.push({ type: "markers", indexes: [...markers], accesses });
      for (const value of buckets[bucket]) {
        array[cursor] = value;
        accesses += 1;
        events.push({ type: "write", index: cursor, value, accesses });
        cursor += 1;
      }
    }
    events.push({ type: "pass", digit, accesses });
    divisor *= radix;
    digit += 1;
  }

  events.push({ type: "markers", indexes: [], accesses });
  events.push({ type: "complete", accesses });
  return { array, events };
}

export function frequencyForValue(value: number, arraySize: number, minFrequency: number, maxFrequency: number) {
  if (arraySize <= 1) return minFrequency;
  const position = Math.max(0, Math.min(1, (value - 1) / (arraySize - 1)));
  return minFrequency + (maxFrequency - minFrequency) * position;
}
