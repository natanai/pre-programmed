import { describe, expect, it } from "vitest";
import { applyTextExpression } from "../src/features/narrative/textExpression";

describe("text expression authoring", () => {
  it("wraps an explicit selection without changing the words", () => {
    const result = applyTextExpression("say this now", { start: 4, end: 8 }, "hit");
    expect(result.value).toBe("say /h{this} now");
    expect(result.selection).toEqual({ start: 7, end: 11 });
  });

  it("uses the word under a collapsed caret", () => {
    const result = applyTextExpression("move slowly now", { start: 7, end: 7 }, "slow");
    expect(result.value).toBe("move /l{slowly} now");
    expect(result.selection).toEqual({ start: 8, end: 14 });
  });

  it("inserts a pause at the end of a selection", () => {
    const result = applyTextExpression("wait here", { start: 0, end: 4 }, "pause");
    expect(result.value).toBe("wait/p here");
    expect(result.selection).toEqual({ start: 6, end: 6 });
  });
});
