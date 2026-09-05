import { describe, expect, it } from "vitest";
import {
  createSeededArray,
  resolveRadixSeed,
  sortEvents,
} from "../src/features/radix/algorithm";
import { createRadixSequence, type SortAlgorithm } from "../src/features/radix/model";
import { normalizeRadixProjectSettings } from "../src/features/radix/projectSettings";

const algorithms: SortAlgorithm[] = ["radix-lsd", "quick", "merge", "heap", "shell"];

describe("sort presentation", () => {
  it.each(algorithms)("sorts a seeded permutation with %s", (algorithm) => {
    const initial = createSeededArray(257, 0x5eed1234);
    const result = sortEvents(initial, algorithm, 4);
    expect(result.array).toEqual(Array.from({ length: 257 }, (_, index) => index + 1));
    expect(result.events.at(-1)?.type).toBe("complete");
  });

  it("keeps fixed text seeds deterministic and random runtime seeds reproducible", () => {
    const text = { ...createRadixSequence(), seedMode: "text" as const, seedValue: "the universe remembers" };
    const textSeed = resolveRadixSeed(text);
    expect(createSeededArray(128, textSeed)).toEqual(createSeededArray(128, resolveRadixSeed(text)));

    const random = { ...createRadixSequence(), seedMode: "random" as const };
    expect(resolveRadixSeed(random, 123456)).toBe(123456);
    expect(createSeededArray(128, resolveRadixSeed(random, 123456))).toEqual(createSeededArray(128, 123456));
  });

  it("normalizes old sequences to radix LSD and preserves authored algorithm choices", () => {
    const legacy = normalizeRadixProjectSettings({ radix: { sequences: [{ id: "legacy", label: "Legacy" }] } });
    expect(legacy.radix.sequences[0]?.algorithm).toBe("radix-lsd");

    const modern = normalizeRadixProjectSettings({ radix: { sequences: [{ id: "modern", label: "Modern", algorithm: "heap" }] } });
    expect(modern.radix.sequences[0]?.algorithm).toBe("heap");
  });
});
