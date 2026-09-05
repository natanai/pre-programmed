import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken, interpolateSemanticReferences } from "../src/engine/references/runtime";
import { parseCommand } from "../src/features/commands/parser";
import { resolveActiveNodeLocationContext } from "../src/features/narrative/locationContext";
import { node, project } from "./fixtures";

function location(id: string, name: string) {
  return {
    id,
    key: id,
    type: "location" as const,
    name,
    description: `${name} description`,
    tags: [],
  };
}

describe("persistent Node location context", () => {
  it("sets, continues, clears, and later replaces location from real traversal", () => {
    const kitchen = location("kitchen", "Kitchen");
    const laboratory = location("laboratory", "Laboratory");
    const snapshot = project({
      startNodeId: "a",
      nodes: [
        { ...node("a", 1), locationMode: "set", locationId: kitchen.id },
        { ...node("b", 2), locationMode: "continue", locationId: null },
        { ...node("c", 3), locationMode: "clear", locationId: null },
        { ...node("d", 4), locationMode: "continue", locationId: null },
        { ...node("e", 5), locationMode: "set", locationId: laboratory.id },
      ],
      entities: [kitchen, laboratory],
    });
    const base = createEmptyPlayState(snapshot);

    expect(resolveActiveNodeLocationContext(snapshot, base))
      .toEqual({ locationId: kitchen.id, sourceNodeId: "a" });
    expect(resolveActiveNodeLocationContext(snapshot, { ...base, currentNodeId: "b", traversal: ["a", "b"] }))
      .toEqual({ locationId: kitchen.id, sourceNodeId: "a" });
    expect(resolveActiveNodeLocationContext(snapshot, { ...base, currentNodeId: "c", traversal: ["a", "b", "c"] }))
      .toBeNull();
    expect(resolveActiveNodeLocationContext(snapshot, { ...base, currentNodeId: "d", traversal: ["a", "b", "c", "d"] }))
      .toBeNull();
    expect(resolveActiveNodeLocationContext(snapshot, { ...base, currentNodeId: "e", traversal: ["a", "b", "c", "d", "e"] }))
      .toEqual({ locationId: laboratory.id, sourceNodeId: "e" });
    expect(base).not.toHaveProperty("currentLocationId");
  });

  it("makes current-location name and description follow the inherited active location", () => {
    const kitchen = location("kitchen", "Kitchen");
    const snapshot = project({
      startNodeId: "a",
      nodes: [
        { ...node("a", 1), locationMode: "set", locationId: kitchen.id },
        { ...node("b", 2), locationMode: "continue", locationId: null },
      ],
      entities: [kitchen],
    });
    const state = { ...createEmptyPlayState(snapshot), currentNodeId: "b", traversal: ["a", "b"] };
    const name = makeSemanticReferenceToken("world.location", "current", "name");
    const description = makeSemanticReferenceToken("world.location", "current", "description");

    expect(interpolateSemanticReferences(`${name}: ${description}`, { snapshot, state }))
      .toBe("Kitchen: Kitchen description");
  });

  it("lets command vocabulary such as here target a location carried from an earlier Node", () => {
    const kitchen = location("kitchen", "Kitchen");
    const base = project({
      startNodeId: "a",
      nodes: [
        { ...node("a", 1), locationMode: "set", locationId: kitchen.id },
        { ...node("b", 2), locationMode: "continue", locationId: null },
      ],
      entities: [kitchen],
    });
    const snapshot = {
      ...base,
      settings: {
        ...base.settings,
        commands: {
          ...base.settings.commands,
          referenceSources: [{ sourceKind: "world.location", enabled: true, includeDefaults: true, aliases: {} }],
          commands: [{
            id: "inspect-here",
            label: "Inspect",
            enabled: true,
            patterns: ["inspect {target}"],
            slots: [{ name: "target", sourceKinds: ["world.location"] }],
            action: { type: "target-operation" as const, operation: "inspect", targetSlot: "target" },
          }],
        },
      },
    };
    const state = { ...createEmptyPlayState(snapshot), currentNodeId: "b", traversal: ["a", "b"] };
    const result = parseCommand("inspect here", snapshot, state);

    expect(result.reason).toBe("command-grammar");
    expect(result.invocation?.target).toEqual({ kind: "world.entity", id: kitchen.id });
  });
});
