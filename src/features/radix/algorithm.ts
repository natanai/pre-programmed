import type { RadixSequenceDefinition, SortAlgorithm } from "./model";

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

function eventRuntime(initial: readonly number[]) {
  const array = [...initial];
  const events: RadixSortEvent[] = [];
  let accesses = 0;
  let passes = 0;

  const access = (index: number) => {
    const value = array[index];
    accesses += 1;
    events.push({ type: "access", index, value, accesses });
    return value;
  };
  const write = (index: number, value: number) => {
    array[index] = value;
    accesses += 1;
    events.push({ type: "write", index, value, accesses });
  };
  const markers = (indexes: number[]) => events.push({ type: "markers", indexes, accesses });
  const pass = () => events.push({ type: "pass", digit: passes++, accesses });
  const swap = (left: number, right: number) => {
    if (left === right) return;
    const leftValue = access(left);
    const rightValue = access(right);
    write(left, rightValue);
    write(right, leftValue);
  };
  const complete = () => {
    markers([]);
    events.push({ type: "complete", accesses });
    return { array, events };
  };

  return { array, events, access, write, markers, pass, swap, complete };
}

/** Independently implemented stable LSD radix sort. */
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
      buckets[Math.floor(value / divisor) % radix].push(value);
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

export function quickSortEvents(initial: readonly number[]) {
  const runtime = eventRuntime(initial);
  const stack: Array<[number, number]> = [[0, runtime.array.length - 1]];
  while (stack.length) {
    const [low, high] = stack.pop()!;
    if (low >= high) continue;
    const pivot = runtime.access(high);
    let partition = low;
    for (let cursor = low; cursor < high; cursor += 1) {
      runtime.markers([low, partition, cursor, high]);
      if (runtime.access(cursor) <= pivot) {
        runtime.swap(partition, cursor);
        partition += 1;
      }
    }
    runtime.swap(partition, high);
    runtime.pass();
    const left: [number, number] = [low, partition - 1];
    const right: [number, number] = [partition + 1, high];
    if (left[1] - left[0] > right[1] - right[0]) {
      stack.push(left, right);
    } else {
      stack.push(right, left);
    }
  }
  return runtime.complete();
}

export function mergeSortEvents(initial: readonly number[]) {
  const runtime = eventRuntime(initial);
  const length = runtime.array.length;
  for (let width = 1; width < length; width *= 2) {
    for (let left = 0; left < length; left += width * 2) {
      const middle = Math.min(left + width, length);
      const right = Math.min(left + width * 2, length);
      if (middle >= right) continue;
      runtime.markers([left, middle, right - 1]);
      const leftValues: number[] = [];
      const rightValues: number[] = [];
      for (let index = left; index < middle; index += 1) leftValues.push(runtime.access(index));
      for (let index = middle; index < right; index += 1) rightValues.push(runtime.access(index));
      let li = 0;
      let ri = 0;
      let target = left;
      while (li < leftValues.length || ri < rightValues.length) {
        const useLeft = ri >= rightValues.length || (li < leftValues.length && leftValues[li] <= rightValues[ri]);
        runtime.write(target++, useLeft ? leftValues[li++] : rightValues[ri++]);
      }
    }
    runtime.pass();
  }
  return runtime.complete();
}

export function heapSortEvents(initial: readonly number[]) {
  const runtime = eventRuntime(initial);
  const siftDown = (start: number, end: number) => {
    let root = start;
    while (root * 2 + 1 <= end) {
      let child = root * 2 + 1;
      let swapIndex = root;
      runtime.markers([root, child, end]);
      if (runtime.access(swapIndex) < runtime.access(child)) swapIndex = child;
      if (child + 1 <= end && runtime.access(swapIndex) < runtime.access(child + 1)) swapIndex = child + 1;
      if (swapIndex === root) return;
      runtime.swap(root, swapIndex);
      root = swapIndex;
    }
  };

  for (let start = Math.floor((runtime.array.length - 2) / 2); start >= 0; start -= 1) siftDown(start, runtime.array.length - 1);
  for (let end = runtime.array.length - 1; end > 0; end -= 1) {
    runtime.swap(0, end);
    siftDown(0, end - 1);
    runtime.pass();
  }
  return runtime.complete();
}

export function shellSortEvents(initial: readonly number[]) {
  const runtime = eventRuntime(initial);
  for (let gap = Math.floor(runtime.array.length / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let index = gap; index < runtime.array.length; index += 1) {
      const value = runtime.access(index);
      let cursor = index;
      runtime.markers([Math.max(0, cursor - gap), cursor]);
      while (cursor >= gap) {
        const previous = runtime.access(cursor - gap);
        if (previous <= value) break;
        runtime.write(cursor, previous);
        cursor -= gap;
        runtime.markers([Math.max(0, cursor - gap), cursor]);
      }
      runtime.write(cursor, value);
    }
    runtime.pass();
  }
  return runtime.complete();
}

export function sortEvents(initial: readonly number[], algorithm: SortAlgorithm, radix: number) {
  switch (algorithm) {
    case "quick": return quickSortEvents(initial);
    case "merge": return mergeSortEvents(initial);
    case "heap": return heapSortEvents(initial);
    case "shell": return shellSortEvents(initial);
    case "radix-lsd":
    default: return radixSortEvents(initial, radix);
  }
}

export function frequencyForValue(value: number, arraySize: number, minFrequency: number, maxFrequency: number) {
  if (arraySize <= 1) return minFrequency;
  const position = Math.max(0, Math.min(1, (value - 1) / (arraySize - 1)));
  return minFrequency + (maxFrequency - minFrequency) * position;
}
