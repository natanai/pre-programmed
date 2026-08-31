import { describe, expect, it } from "vitest";
import { compileTextNotation } from "../src/game/textNotation";

const performance = { charactersPerSecond: 20, cues: [] };

describe("inline text notation", () => {
  it("strips control notation and creates scoped cues", () => {
    const compiled = compileTextNotation("wait /p then /f{run} and /s{MOVE!}", performance);
    expect(compiled.text).toBe("wait  then run and MOVE!");
    expect(compiled.performance.cues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "pause", start: 5, end: 5, value: 350 }),
      expect.objectContaining({ type: "speed", start: 11, end: 14, value: 40 }),
      expect.objectContaining({ type: "shake", start: 19, end: 24 }),
    ]));
  });

  it("supports custom pauses, hit, instant, wave, blink, and literal slashes", () => {
    const compiled = compileTextNotation("A/p800B /h{BAM} /i{now} /w{soft} /b{gone} //path", performance);
    expect(compiled.text).toBe("AB BAM now soft gone /path");
    expect(compiled.performance.cues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "pause", value: 800 }),
      expect.objectContaining({ type: "instant", start: 3, end: 6 }),
      expect.objectContaining({ type: "shake", start: 3, end: 6 }),
      expect.objectContaining({ type: "wave" }),
      expect.objectContaining({ type: "blink" }),
    ]));
  });

  it("does not treat normal slash-p words as pause commands", () => {
    const compiled = compileTextNotation("go to /place and //pause", performance);
    expect(compiled.text).toBe("go to /place and /pause");
    expect(compiled.performance.cues).toHaveLength(0);
  });

  it("remaps existing authored cue positions after stripping notation", () => {
    const compiled = compileTextNotation("a /f{bc} d", {
      charactersPerSecond: 20,
      cues: [{ id: "manual", type: "blink", start: 5, end: 7 }],
    });
    expect(compiled.text).toBe("a bc d");
    expect(compiled.performance.cues.find((cue) => cue.id === "manual")).toMatchObject({ start: 2, end: 4 });
  });
});
