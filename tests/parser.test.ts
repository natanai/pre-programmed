import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { normalizeCommand, parseCommand } from "../src/features/narrative/parser";
import { interaction, node, project } from "./fixtures";

function commandSettings(commands: any[], sourceKinds: string[] = []) {
  return {
    terminalPrompt: "U:\\>",
    commands: {
      starterRevision: 3,
      referenceSources: sourceKinds.map((sourceKind) => ({ sourceKind, enabled: true, includeDefaults: true, aliases: {} })),
      commands,
    },
  };
}

describe("deterministic parser", () => {
  it("normalizes case, punctuation, unicode compatibility, and whitespace", () => {
    expect(normalizeCommand("  ＬＯＯＫ,   Door!! ")).toBe("look door");
  });

  it("prefers a literal authored alias before normalized matching", () => {
    const snapshot = project({ interactions: [interaction("literal", "a", null, ["LOOK"]), interaction("normalized", "a", null, ["look"])] });
    const result = parseCommand("LOOK", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("exact-alias");
    expect(result.interaction?.id).toBe("literal");
  });

  it("resolves normalized scene-alias ambiguity by stable ID ordering", () => {
    const snapshot = project({ interactions: [interaction("z", "a", null, ["Open Door"]), interaction("a", "a", null, ["open-door"])] });
    const result = parseCommand("open, door", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("normalized-alias");
    expect(result.interaction?.id).toBe("a");
    expect(result.candidates).toEqual(["a", "z"]);
  });

  it("does not infer fuzzy phrases that were never authored", () => {
    const snapshot = project({ interactions: [interaction("inspect", "a", null, ["inspect old door"])] });
    expect(parseCommand("please inspect the old wooden door", snapshot, createEmptyPlayState(snapshot))).toMatchObject({ interaction: null, invocation: null, reason: "fallback" });
  });

  it("matches project grammar through a semantic location provider", () => {
    const snapshot = project({
      entities: [{ id: "birthplace", key: "birthplace", type: "location", name: "Birthplace", description: "", tags: ["home"] }],
      settings: commandSettings([{
        id: "travel-command",
        label: "Travel",
        enabled: true,
        patterns: ["{place}", "go {place}"],
        slots: [{ name: "place", sourceKinds: ["world.location"] }],
        action: { type: "target-operation", operation: "travel", targetSlot: "place" },
      }], ["world.location"]),
    });
    const result = parseCommand("birthplace", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("command-grammar");
    expect(result.invocation).toMatchObject({
      commandId: "travel-command",
      operation: "travel",
      target: { kind: "world.entity", id: "birthplace" },
      arguments: { place: { kind: "target", sourceKind: "world.location", candidateId: "birthplace" } },
    });
  });

  it("resolves contextual 'here' to the canonical location of the current Node", () => {
    const snapshot = project({
      nodes: [{ ...node("a", 1), locationId: "kitchen" }],
      entities: [{ id: "kitchen", key: "kitchen", type: "location", name: "Kitchen", description: "", tags: [] }],
      settings: commandSettings([{
        id: "inspect",
        label: "Inspect",
        enabled: true,
        patterns: ["inspect {target}"],
        slots: [{ name: "target", sourceKinds: ["world.location"] }],
        action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
      }], ["world.location"]),
    });
    const result = parseCommand("inspect here", snapshot, createEmptyPlayState(snapshot));
    expect(result.invocation?.target).toEqual({ kind: "world.entity", id: "kitchen" });
    expect(result.invocation?.arguments.target).toMatchObject({ sourceKind: "world.location", candidateId: "current" });
  });

  it("keeps Character identities out of project-wide target operations", () => {
    const snapshot = project({
      entities: [
        { id: "kitchen", key: "kitchen", type: "location", name: "Kitchen", description: "", tags: [] },
        { id: "guard", key: "guard", type: "character", name: "Guard", description: "", tags: [] },
      ],
      settings: commandSettings([{
        id: "inspect",
        label: "Inspect",
        enabled: true,
        patterns: ["inspect {target}"],
        slots: [{ name: "target", sourceKinds: ["world.location", "world.character"] }],
        action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
      }], ["world.location", "world.character"]),
    });
    const state = createEmptyPlayState(snapshot);
    expect(parseCommand("inspect kitchen", snapshot, state).invocation?.target?.id).toBe("kitchen");
    expect(parseCommand("inspect guard", snapshot, state).invocation).toBeNull();
  });

  it("does not let a Character name create target ambiguity with a Location", () => {
    const snapshot = project({
      entities: [
        { id: "alex-place", key: "alex-place", type: "location", name: "Alex", description: "", tags: [] },
        { id: "alex-person", key: "alex-person", type: "character", name: "Alex", description: "", tags: [] },
      ],
      settings: commandSettings([{
        id: "inspect",
        label: "Inspect",
        enabled: true,
        patterns: ["inspect {target}"],
        slots: [{ name: "target", sourceKinds: ["world.location", "world.character"] }],
        action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
      }], ["world.location", "world.character"]),
    });
    const result = parseCommand("inspect alex", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("command-grammar");
    expect(result.invocation?.target).toEqual({ kind: "world.entity", id: "alex-place" });
  });

  it("transports text-response commands through the generic operation runtime", () => {
    const snapshot = project({ settings: commandSettings([{
      id: "where",
      label: "Where",
      enabled: true,
      patterns: ["where", "where am i"],
      slots: [],
      action: { type: "response", responseText: "Here.", responsePerformance: { charactersPerSecond: 18, cues: [] }, speakerId: null, effects: [] },
    }]) });
    const result = parseCommand("where", snapshot, createEmptyPlayState(snapshot));
    expect(result.invocation).toMatchObject({ operation: "commands.respond", target: { kind: "player-command", id: "where" } });
  });

  it("lets a local scene alias override a project-wide grammar match", () => {
    const snapshot = project({
      interactions: [interaction("scene", "a", null, ["birthplace"])],
      entities: [{ id: "birthplace", key: "birthplace", type: "location", name: "Birthplace", description: "", tags: [] }],
      settings: commandSettings([{
        id: "travel-command", label: "Travel", enabled: true, patterns: ["{place}"],
        slots: [{ name: "place", sourceKinds: ["world.location"] }],
        action: { type: "target-operation", operation: "travel", targetSlot: "place" },
      }], ["world.location"]),
    });
    const result = parseCommand("birthplace", snapshot, createEmptyPlayState(snapshot));
    expect(result.reason).toBe("exact-alias");
    expect(result.interaction?.id).toBe("scene");
    expect(result.invocation).toBeNull();
  });

  it("uses the authored fallback only after aliases and project grammar fail", () => {
    const fallback = { ...interaction("invalid", "a", null, []), matchMode: "fallback" as const };
    const snapshot = project({ interactions: [fallback] });
    expect(parseCommand("sing", snapshot, createEmptyPlayState(snapshot))).toMatchObject({ interaction: { id: "invalid" }, invocation: null, reason: "fallback" });
  });

  it("keeps typing-only choices available to the deterministic parser", () => {
    const typed = { ...interaction("secret", "a", null, ["whisper"]), choiceVisibility: "typed" as const };
    const snapshot = project({ interactions: [typed] });
    expect(parseCommand("whisper", snapshot, createEmptyPlayState(snapshot)).interaction?.id).toBe("secret");
  });
});
