import { describe, expect, it } from "vitest";
import {
  authorSemanticReferenceView,
  storeAuthorSemanticReferences,
} from "../src/engine/references/authorSyntax";
import { migrateLegacyReferenceTokens } from "../src/engine/references/migration";
import { semanticReferenceProvider } from "../src/engine/references/catalog";
import {
  interpolateSemanticReferences,
  makeSemanticReferenceToken,
} from "../src/engine/references/runtime";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { parseCommand } from "../src/features/commands/parser";
import { executeOperation } from "../src/features/operations/runtime";
import { node, project } from "./fixtures";

function worldEntity(id: string, type: "character" | "location", name: string) {
  return {
    id,
    key: id,
    type,
    name,
    description: `${name} description`,
    tags: [],
  };
}

function withCommands(snapshot: ReturnType<typeof project>, commands: typeof snapshot.settings.commands.commands, referenceSources = snapshot.settings.commands.referenceSources) {
  return {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      commands: {
        ...snapshot.settings.commands,
        commands,
        referenceSources,
      },
    },
  };
}

describe("semantic reference foundation", () => {
  it("derives current location from the current Node without duplicating play state", () => {
    const kitchen = worldEntity("kitchen", "location", "Kitchen");
    const laboratory = worldEntity("laboratory", "location", "Laboratory");
    const snapshot = project({
      startNodeId: "a",
      nodes: [
        { ...node("a", 1), locationId: kitchen.id },
        { ...node("b", 2), locationId: laboratory.id },
      ],
      entities: [kitchen, laboratory],
    });
    const token = makeSemanticReferenceToken("world.location", "current", "name");
    const stateA = createEmptyPlayState(snapshot);
    const stateB = { ...stateA, currentNodeId: "b", traversal: ["a", "b"] };

    expect(interpolateSemanticReferences(`You are in ${token}.`, { snapshot, state: stateA })).toBe("You are in Kitchen.");
    expect(interpolateSemanticReferences(`You are in ${token}.`, { snapshot, state: stateB })).toBe("You are in Laboratory.");
    expect(stateA).not.toHaveProperty("currentLocationId");
    expect(stateB).not.toHaveProperty("currentLocationId");
  });

  it("routes a contextual location reference to the real Location owner, or the owning Node when unset", () => {
    const kitchen = worldEntity("kitchen", "location", "Kitchen");
    const assigned = project({
      nodes: [{ ...node("a", 1), locationId: kitchen.id }],
      entities: [kitchen],
    });
    const assignedState = createEmptyPlayState(assigned);
    const assignedCurrent = semanticReferenceProvider("world.location")!
      .candidates({ snapshot: assigned, state: assignedState })
      .find((candidate) => candidate.id === "current");

    expect(assignedCurrent?.author).toEqual({ resourceKind: "location", resourceId: kitchen.id });

    const unassigned = project();
    const unassignedState = createEmptyPlayState(unassigned);
    const unassignedCurrent = semanticReferenceProvider("world.location")!
      .candidates({ snapshot: unassigned, state: unassignedState })
      .find((candidate) => candidate.id === "current");

    expect(unassignedCurrent?.author).toEqual({ resourceKind: "node", resourceId: "a" });
    expect(unassignedCurrent?.projections.name).toBe("");
  });

  it("migrates legacy State interpolation to stable semantic resource ids", () => {
    const snapshot = project({
      variables: [{
        id: "variable-health",
        key: "health",
        label: "Health",
        valueType: "number",
        initialValue: 100,
        interactable: false,
        operations: [],
        hooks: [],
      }],
    });

    expect(migrateLegacyReferenceTokens("Health: {{variable:health}}", snapshot))
      .toBe(`Health: ${makeSemanticReferenceToken("state.variable", "variable-health", "value")}`);
  });

  it("shows stable resource ids as human-facing Author syntax without changing persistence", () => {
    const birthplace = {
      ...worldEntity("c6bc068b-11e5-4ca9-8fc5-18e5a1639482", "location", "Birthplace"),
      key: "birthplace",
    };
    const snapshot = project({
      nodes: [{ ...node("a", 1), locationId: birthplace.id }],
      entities: [birthplace],
    });
    const context = { snapshot, state: createEmptyPlayState(snapshot) };
    const stored = `You are born. ${makeSemanticReferenceToken("world.location", birthplace.id, "name")}`;
    const view = authorSemanticReferenceView(stored, context);

    expect(view.text).toBe("You are born. {{location:birthplace}}");
    expect(storeAuthorSemanticReferences(view.text, context)).toBe(stored);
  });

  it("shows contextual references in compact human syntax and keeps their stable selector identity", () => {
    const birthplace = {
      ...worldEntity("location-birthplace", "location", "Birthplace"),
      key: "birthplace",
    };
    const snapshot = project({
      nodes: [{ ...node("a", 1), locationId: birthplace.id }],
      entities: [birthplace],
    });
    const context = { snapshot, state: createEmptyPlayState(snapshot) };
    const stored = makeSemanticReferenceToken("world.location", "current", "name");
    const view = authorSemanticReferenceView(stored, context);

    expect(view.text).toBe("{{current-location}}");
    expect(storeAuthorSemanticReferences(view.text, context)).toBe(stored);
  });

  it("keeps Character identities referenceable without making them global operation targets", () => {
    const kitchen = worldEntity("kitchen", "location", "Kitchen");
    const guide = worldEntity("guide", "character", "Guide");
    const base = project({
      nodes: [{ ...node("a", 1), locationId: kitchen.id }],
      entities: [kitchen, guide],
    });
    const snapshot = withCommands(base, [{
      id: "inspect-anything",
      label: "Inspect",
      enabled: true,
      patterns: ["inspect {target}"],
      slots: [{ name: "target", sourceKinds: ["world.location", "world.character"] }],
      action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
    }], [
      { sourceKind: "world.location", enabled: true, includeDefaults: true, aliases: {} },
      { sourceKind: "world.character", enabled: true, includeDefaults: true, aliases: {} },
    ]);
    const state = createEmptyPlayState(snapshot);

    expect(interpolateSemanticReferences(makeSemanticReferenceToken("world.character", guide.id, "name"), { snapshot, state }))
      .toBe("Guide");
    expect(parseCommand("inspect kitchen", snapshot, state).invocation?.target)
      .toEqual({ kind: "world.entity", id: kitchen.id });
    expect(parseCommand("inspect guide", snapshot, state).invocation).toBeNull();
  });

  it("resolves contextual player vocabulary such as here through the same current-location identity", () => {
    const kitchen = worldEntity("kitchen", "location", "Kitchen");
    const base = project({
      nodes: [{ ...node("a", 1), locationId: kitchen.id }],
      entities: [kitchen],
    });
    const snapshot = withCommands(base, [{
      id: "inspect-here",
      label: "Inspect",
      enabled: true,
      patterns: ["inspect {target}"],
      slots: [{ name: "target", sourceKinds: ["world.location"] }],
      action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
    }], [{ sourceKind: "world.location", enabled: true, includeDefaults: true, aliases: {} }]);
    const result = parseCommand("inspect here", snapshot, createEmptyPlayState(snapshot));

    expect(result.reason).toBe("command-grammar");
    expect(result.invocation?.arguments.target).toMatchObject({
      kind: "target",
      sourceKind: "world.location",
      candidateId: "current",
      target: { kind: "world.entity", id: kitchen.id },
    });
  });

  it("does not let a descriptive Character collide with a targetable Location", () => {
    const place = worldEntity("alex-place", "location", "Alex");
    const person = worldEntity("alex-person", "character", "Alex");
    const base = project({ entities: [place, person] });
    const snapshot = withCommands(base, [{
      id: "inspect-alex",
      label: "Inspect",
      enabled: true,
      patterns: ["inspect {target}"],
      slots: [{ name: "target", sourceKinds: ["world.location", "world.character"] }],
      action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
    }], [
      { sourceKind: "world.location", enabled: true, includeDefaults: true, aliases: {} },
      { sourceKind: "world.character", enabled: true, includeDefaults: true, aliases: {} },
    ]);
    const result = parseCommand("inspect Alex", snapshot, createEmptyPlayState(snapshot));

    expect(result.reason).toBe("command-grammar");
    expect(result.invocation?.target).toEqual({ kind: "world.entity", id: place.id });
    expect(result.ambiguities).toHaveLength(0);
  });

  it("executes a project-wide response command with live semantic interpolation and canonical provenance", () => {
    const kitchen = worldEntity("kitchen", "location", "Kitchen");
    const currentLocation = makeSemanticReferenceToken("world.location", "current", "name");
    const base = project({
      nodes: [{ ...node("a", 1), locationId: kitchen.id }],
      entities: [kitchen],
    });
    const snapshot = withCommands(base, [{
      id: "where-command",
      label: "Where am I?",
      enabled: true,
      patterns: ["where", "where am i", "location"],
      slots: [],
      action: {
        type: "response",
        responseText: `You are in ${currentLocation}.`,
        responsePerformance: { charactersPerSecond: 18, cues: [] },
        speakerId: null,
        effects: [],
      },
    }]);
    const state = createEmptyPlayState(snapshot);
    const parsed = parseCommand("where", snapshot, state);

    expect(parsed.reason).toBe("command-grammar");
    expect(parsed.invocation?.target).toEqual({ kind: "player-command", id: "where-command" });

    const execution = executeOperation(snapshot, state, {
      target: parsed.invocation!.target!,
      operation: parsed.invocation!.operation,
      arguments: parsed.invocation!.arguments,
    });
    expect(execution.accepted).toBe(true);
    expect(execution.responseText).toBe("You are in Kitchen.");
    expect(execution.source).toMatchObject({
      resourceKind: "player-command",
      resourceId: "where-command",
      focus: { operation: "commands.respond" },
    });
  });
});
