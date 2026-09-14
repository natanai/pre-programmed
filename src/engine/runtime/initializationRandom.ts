function normalizeSeed(seed: number) {
  return (Math.trunc(seed) >>> 0) || 1;
}

/** Stable text hashing used to turn authored and keyed initialization identities into uint32 seeds. */
export function hashInitializationText(text: string) {
  let hash = 2166136261 >>> 0;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 1;
}

/** One cryptographically sourced seed for a newly initialized world. */
export function randomInitializationSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || 1;
}

export function normalizeInitializationSeed(seed: number) {
  return normalizeSeed(seed);
}

/** Deterministic PRNG used by every initialization consumer of a resolved world seed. */
export function createSeededRandom(seed: number) {
  let state = normalizeSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Derive a stable keyed stream from the one world seed without making results
 * depend on how many unrelated initialization consumers happen to run first.
 */
export function deriveInitializationSeed(seed: number, key: string) {
  return hashInitializationText(`${normalizeSeed(seed)}:${key}`);
}

export function seededInitializationIndex(seed: number, key: string, length: number) {
  if (length <= 0) return -1;
  const random = createSeededRandom(deriveInitializationSeed(seed, key));
  return Math.floor(random() * length);
}

export function pickSeededInitializationValue<T>(
  seed: number,
  key: string,
  values: readonly T[],
): T | undefined {
  const index = seededInitializationIndex(seed, key, values.length);
  return index < 0 ? undefined : values[index];
}
