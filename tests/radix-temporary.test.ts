import { describe, expect, it } from "vitest";
import {
  createSeededArray,
  frequencyForValue,
  radixSortEvents,
  resolveRadixSeed,
} from "../src/features/radix/algorithm";
import { createRadixSequence } from "../src/features/radix/model";
import { radixEffectEventsForTextCue } from "../src/features/radix/textCueEvents";
import { RADIX_EFFECT_HANDLERS } from "../src/features/radix/effectRuntime";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { project } from "./fixtures";

describe("radix presentation engine", () => {
  it("turns a text seed into the same universe every time", () => {
    const sequence = { ...createRadixSequence(), seedMode: "text" as const, seedValue: "there is no free will" };
    const firstSeed = resolveRadixSeed(sequence);
    const secondSeed = resolveRadixSeed(sequence);

    expect(secondSeed).toBe(firstSeed);
    expect(createSeededArray(256, secondSeed)).toEqual(createSeededArray(256, firstSeed));
  });

  it("lets random-mode runs be reproduced when their runtime seed is known", () => {
    const sequence = { ...createRadixSequence(), seedMode: "random" as const };
    expect(resolveRadixSeed(sequence, 123456)).toBe(123456);
    expect(createSeededArray(64, 123456)).toEqual(createSeededArray(64, 123456));
    expect(createSeededArray(64, 123456)).not.toEqual(createSeededArray(64, 654321));
  });

  it("stably sorts a dense seeded array and emits complete semantic events", () => {
    const initial = createSeededArray(257, 0xdecafbad);
    const result = radixSortEvents(initial, 4);

    expect(result.array).toEqual(Array.from({ length: 257 }, (_, index) => index + 1));
    expect(result.events.at(-1)).toEqual({ type: "complete", accesses: 2570 });
    expect(result.events.some((event) => event.type === "markers" && event.indexes.length > 1)).toBe(true);
    expect(result.events.some((event) => event.type === "pass" && event.digit === 4)).toBe(true);
  });

  it("maps the lowest and highest bars exactly to the authored frequency range", () => {
    expect(frequencyForValue(1, 256, 120, 1212)).toBe(120);
    expect(frequencyForValue(256, 256, 120, 1212)).toBe(1212);
  });

  it("turns a node or response text cue into the same reusable presentation event", () => {
    expect(radixEffectEventsForTextCue({
      id: "cue",
      type: "radix",
      start: 3,
      end: 3,
      value: "universe-sort",
    })).toEqual([{ type: "radix", sequenceId: "universe-sort" }]);
  });

  it("accepts authored radix effects only when their sequence exists", () => {
    const snapshot = project();
    const sequence = { ...createRadixSequence(), id: "universe-sort" };
    snapshot.settings.radix.sequences = [sequence];
    const state = createEmptyPlayState(snapshot);
    const handler = RADIX_EFFECT_HANDLERS.radix;

    expect(handler({ id: "fx", type: "radix", sequenceId: sequence.id }, snapshot, state).events)
      .toEqual([{ type: "radix", sequenceId: sequence.id }]);
    expect(handler({ id: "missing", type: "radix", sequenceId: "missing" }, snapshot, state).events)
      .toEqual([]);
  });
});
