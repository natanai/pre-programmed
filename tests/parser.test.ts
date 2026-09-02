import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { normalizeCommand, parseCommand } from "../src/features/narrative/parser";
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

  it("resolves normalized scene-alias ambiguity by stable ID ordering", () => {
    const snapshot = project({ interactions: [
      interaction("z", "a", null, ["Open Door"]),
      interaction("a", "a", null, ["open-door"]),
    ] });
    const result = parseCommand("open, door", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("normalized-alias");
    expect(result.interaction?.id).toBe("a");
    expect(result.candidates).toEqual(["a", "z"]);
  });

  it("does not infer fuzzy phrases that were never authored", () => {
    const snapshot = project({ interactions: [interaction("inspect", "a", null, ["inspect old door"])] });
    const state = createEmptyPlayState(snapshot);
    expect(parseCommand("please inspect the old wooden door", snapshot, state)).toMatchObject({
      interaction: null,
      invocation: null,
      reason: "fallback",
    });
  });

  it("matches project grammar and resolves a bare authored location reference", () => {
    const snapshot = project({
      entities: [{
        id: "birthplace",
        key: "birthplace",
        type: "location",
        name: "Birthplace",
        description: "",
        tags: ["home"],
      }],
      settings: {
        terminalPrompt: "U:\\>",
        commands: {
          referenceSources: [{
            sourceKind: "world.location",
            enabled: true,
            includeDefaults: true,
            aliases: {},
          }],
          commands: [{
            id: "travel-command",
            label: "Travel",
            operation: "travel",
            enabled: true,
            patterns: ["{place}", "go {place}"],
            slots: [{ name: "place", sourceKind: "world.location" }],
            targetSlot: "place",
          }],
        },
      },
    });
    const state = createEmptyPlayState(snapshot);
    const result = parseCommand("birthplace", snapshot, state);
    expect(result.reason).toBe("command-grammar");
    expect(result.matchedPattern).toBe("{place}");
    expect(result.invocation).toMatchObject({
      commandId: "travel-command",
      operation: "travel",
      target: { kind: "world.entity", id: "birthplace" },
      arguments: {
        place: {
          kind: "target",
          sourceKind: "world.location",
          candidateId: "birthplace",
        },
      },
    });
  });

  it("lets a local scene alias override a project-wide grammar match", () => {
    const snapshot = project({
      interactions: [interaction("scene", "a", null, ["birthplace"])],
      entities: [{ id: "birthplace", key: "birthplace", type: "location", name: "Birthplace", description: "", tags: [] }],
      settings: {
        terminalPrompt: "U:\\>",
        commands: {
          referenceSources: [{ sourceKind: "world.location", enabled: true, includeDefaults: true, aliases: {} }],
          commands: [{
            id: "travel-command",
            label: "Travel",
            operation: "travel",
            enabled: true,
            patterns: ["{place}"],
            slots: [{ name: "place", sourceKind: "world.location" }],
            targetSlot: "place",
          }],
        },
      },
    });
    const result = parseCommand("birthplace", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("exact-alias");
    expect(result.interaction?.id).toBe("scene");
    expect(result.invocation).toBeNull();
  });

  it("uses the authored fallback only after aliases and project grammar fail", () => {
    const fallback = { ...interaction("invalid", "a", null, []), matchMode: "fallback" as const };
    const snapshot = project({ interactions: [fallback] });
    expect(parseCommand("sing", snapshot, createEmptyPlayState(snapshot))).toMatchObject({
      interaction: { id: "invalid" },
      invocation: null,
      reason: "fallback",
      matchedAlias: null,
    });
  });

  it("keeps typing-only choices available to the deterministic parser", () => {
    const typed = { ...interaction("secret", "a", null, ["whisper"]), choiceVisibility: "typed" as const };
    const snapshot = project({ interactions: [typed] });
    expect(parseCommand("whisper", snapshot, createEmptyPlayState(snapshot)).interaction?.id).toBe("secret");
  });
});
