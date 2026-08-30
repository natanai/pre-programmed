import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/game/model";
import { normalizeCommand, parseCommand } from "../src/game/parser";
import { interaction, project } from "./fixtures";

describe("deterministic parser", () => {
  it("normalizes case, punctuation, unicode compatibility, and whitespace", () => {
    expect(normalizeCommand("  ＬＯＯＫ,   Door!! ")).toBe("look door");
  });

  it("prefers a literal authored alias before normalized matching", () => {
    const snapshot = project({ interactions: [
      interaction("literal", "a", null, ["LOOK"]),
      interaction("normalized", "a", null, ["look"]),
    ] });
    const result = parseCommand("LOOK", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("exact-alias");
    expect(result.interaction?.id).toBe("literal");
  });

  it("resolves normalized ambiguity by stable ID ordering", () => {
    const snapshot = project({ interactions: [
      interaction("z", "a", null, ["Open Door"]),
      interaction("a", "a", null, ["open-door"]),
    ] });
    const result = parseCommand("open, door", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("normalized-alias");
    expect(result.interaction?.id).toBe("a");
    expect(result.candidates).toEqual(["a", "z"]);
  });

  it("uses phrase rules and then falls through without inference", () => {
    const snapshot = project({ interactions: [interaction("inspect", "a", null, ["inspect old door"])] });
    const state = createEmptyPlayState(snapshot);
    expect(parseCommand("please inspect the old wooden door", snapshot, state).reason).toBe("phrase-rule");
    expect(parseCommand("sing", snapshot, state)).toMatchObject({ interaction: null, reason: "fallback" });
  });
});
