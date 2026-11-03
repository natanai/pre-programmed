import { describe, expect, it } from "vitest";
import { compileTextNotation } from "../src/features/narrative/textNotation";

describe("authored text performance cues", () => {
  it("preserves authored Media cue IDs and values in ordinary narration", () => {
    const compiled = compileTextNotation("You accept the bounty.", {
      charactersPerSecond: 24,
      cues: [{ id: "cinematic", type: "sprite", start: 1, end: 2, value: "digi.mn.cutaway.cleaner-briefing" }],
    });
    expect(compiled.text).toBe("You accept the bounty.");
    expect(compiled.performance.cues).toContainEqual({
      id: "cinematic", type: "sprite", start: 1, end: 2, value: "digi.mn.cutaway.cleaner-briefing",
    });
  });

  it("maps authored cue offsets through inline notation without deleting inline cues", () => {
    const text = "A /w{shining} egg /p300 appears";
    const start = text.indexOf("appears");
    const compiled = compileTextNotation(text, {
      charactersPerSecond: 18,
      cues: [{ id: "author-audio", type: "audio", start, end: start + 3, value: "audio.sfx" }],
    });
    expect(compiled.text).toBe("A shining egg  appears");
    const authored = compiled.performance.cues.find(cue => cue.id === "author-audio");
    expect(authored?.start).toBe(compiled.text.indexOf("appears"));
    expect(authored?.end).toBe(compiled.text.indexOf("appears") + 3);
    expect(compiled.performance.cues.some(cue => cue.type === "wave")).toBe(true);
    expect(compiled.performance.cues.some(cue => cue.type === "pause")).toBe(true);
  });

  it("keeps zero-width event cues at their remapped text position", () => {
    const text = "/i{Hello} there";
    const compiled = compileTextNotation(text, {
      charactersPerSecond: 18,
      cues: [{ id: "art", type: "sprite", start: text.indexOf("there"), end: text.indexOf("there"), value: "image" }],
    });
    expect(compiled.text).toBe("Hello there");
    expect(compiled.performance.cues.find(cue => cue.id === "art")).toMatchObject({
      start: 6, end: 6, value: "image",
    });
  });
});
