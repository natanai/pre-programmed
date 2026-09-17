import { describe, expect, it } from "vitest";
import { notationForNodeOpeningCondition } from "../src/features/narrative/author/notation";

describe("Node Entry Response notation", () => {
  it("uses terse bracketed occurrence notation for the common timing presets", () => {
    expect(notationForNodeOpeningCondition({ type: "always" })).toBe("[ANY]");
    expect(notationForNodeOpeningCondition({ type: "attempt", operator: "eq", value: 1 })).toBe("[1]");
    expect(notationForNodeOpeningCondition({ type: "attempt", operator: "eq", value: 2 })).toBe("[2]");
    expect(notationForNodeOpeningCondition({ type: "attempt", operator: "gte", value: 2 })).toBe("[2+]");
  });

  it("keeps uncommon timing and nested rules compact instead of falling back to prose", () => {
    expect(notationForNodeOpeningCondition({ type: "attempt", operator: "neq", value: 3 })).toBe("[!=3]");
    expect(notationForNodeOpeningCondition({ type: "variable", key: "mood", operator: "eq", value: "angry" })).toBe("[VAR]");
    expect(notationForNodeOpeningCondition({ type: "all", conditions: [{ type: "always" }, { type: "always" }] })).toBe("[ALL:2]");
  });
});
