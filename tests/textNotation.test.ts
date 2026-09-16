import { describe, expect, it } from "vitest";
import { compileTextNotation, validateTextNotation } from "../src/features/narrative/textNotation";

const performance = { charactersPerSecond: 18, cues: [] };

describe("core text appearance notation", () => {
  it("compiles transparency, HEX color, and timed disappearance through the shared cue model", () => {
    const compiled = compileTextNotation(
      "/transparency40{ghost} /color#ff8800{ember} /disappear2.5{soon}",
      performance,
    );

    expect(compiled.text).toBe("ghost ember soon");
    expect(compiled.performance.cues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "transparency", start: 0, end: 5, value: 40 }),
      expect.objectContaining({ type: "color", start: 6, end: 11, value: "#FF8800" }),
      expect.objectContaining({ type: "disappear", start: 12, end: 16, value: 2.5 }),
    ]));
  });

  it("accepts short HEX and boundary transparency while rejecting malformed values", () => {
    expect(validateTextNotation("/color#abc{ok} /transparency0{solid} /transparency100{invisible} /disappear0{now}"))
      .toEqual([]);

    const issues = validateTextNotation("/transparency101{x} /color#GG0000{x} /disappear3600.001{x}");
    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      expect.stringContaining("transparency"),
      expect.stringContaining("HEX"),
      expect.stringContaining("3600"),
    ]));
  });
});
