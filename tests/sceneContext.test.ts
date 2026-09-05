import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken, interpolateSemanticReferences } from "../src/engine/references/runtime";
import { parseCommand } from "../src/features/commands/parser";
import { resolveActiveNodeAnchor } from "../src/features/narrative/anchor";
import { resolveActiveNodeLocationContext, resolveActiveNodeSceneContext } from "../src/features/narrative/sceneContext";
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

function character(id: string, name: string) {
  return {
    id,
    key: id,
    type: "character" as const,
    name,
    description: `${name} description`,
    tags: [],
  };
}

describe("Node Scene context", () => {
  it("sets, continues, and clears each hand-authored scene dimension independently", () => {
    const kitchen = location("kitchen", "Kitchen");
    const marta = character("marta", "Marta");
    const guard = character("guard", "Guard");
    const snapshot = project({
      startNodeId: "a",
      nodes: [
        {
          ...node("a", 1),
          locationMode: "set",
          locationId: kitchen.id,
          presentCharacters: { mode: "set", characterIds: [marta.id, guard.id] },
          conversation: { mode: "clear", characterIds: [] },
          anchor: { mode: "set", text: "ASK ABOUT THE LETTER" },
        },
        {
          ...node("b", 2),
          locationMode: "continue",
          locationId: null,
          presentCharacters: { mode: "continue", characterIds: [] },
          conversation: { mode: "set", characterIds: [marta.id] },
          anchor: { mode: "continue", text: "" },
        },
        {
          ...node("c", 3),
          locationMode: "continue",
          locationId: null,
          presentCharacters: { mode: "set", characterIds: [guard.id] },
          conversation: { mode: "continue", characterIds: [] },
          anchor: { mode: "clear", text: "" },
        },
        {
          ...node("d", 4),
          locationMode: "clear",
          locationId: null,
          presentCharacters: { mode: "clear", characterIds: [] },
          conversation: { mode: "clear", characterIds: [] },
          anchor: { mode: "continue", text: "" },
        },
      ],
      entities: [kitchen, marta, guard],
    });
    const base = createEmptyPlayState(snapshot);
    const talking = { ...base, currentNodeId: "b", traversal: ["a", "b"] };
    const changedPresence = { ...base, currentNodeId: "c", traversal: ["a", "b", "c"] };
    const cleared = { ...base, currentNodeId: "d", traversal: ["a", "b", "c", "d"] };

    expect(resolveActiveNodeSceneContext(snapshot, talking)).toEqual({
      location: { locationId: kitchen.id, sourceNodeId: "a" },
      presentCharacters: { characterIds: [marta.id, guard.id], sourceNodeId: "a" },
      conversation: { characterIds: [marta.id], sourceNodeId: "b" },
    });
    expect(resolveActiveNodeAnchor(snapshot, talking)?.text).toBe("ASK ABOUT THE LETTER");

    expect(resolveActiveNodeSceneContext(snapshot, changedPresence)).toEqual({
      location: { locationId: kitchen.id, sourceNodeId: "a" },
      presentCharacters: { characterIds: [guard.id], sourceNodeId: "c" },
      conversation: { characterIds: [marta.id], sourceNodeId: "b" },
    });
    expect(resolveActiveNodeAnchor(snapshot, changedPresence)).toBeNull();

    expect(resolveActiveNodeSceneContext(snapshot, cleared)).toEqual({
      location: null,
      presentCharacters: null,
      conversation: null,
    });
    expect(base).not.toHaveProperty("currentLocationId");
    expect(base).not.toHaveProperty("presentCharacterIds");
    expect(base).not.toHaveProperty("conversationCharacterIds");
  });

  it("lets the same Continue Node inherit different scene context from different real branches", () => {
    const marta = character("marta", "Marta");
    const guard = character("guard", "Guard");
    const snapshot = project({
      startNodeId: "start",
      nodes: [
        { ...node("start", 1) },
        {
          ...node("marta-branch", 2),
          presentCharacters: { mode: "set", characterIds: [marta.id] },
          conversation: { mode: "set", characterIds: [marta.id] },
        },
        {
          ...node("guard-branch", 3),
          presentCharacters: { mode: "set", characterIds: [guard.id] },
          conversation: { mode: "set", characterIds: [guard.id] },
        },
        {
          ...node("shared", 4),
          presentCharacters: { mode: "continue", characterIds: [] },
          conversation: { mode: "continue", characterIds: [] },
        },
      ],
      entities: [marta, guard],
    });
    const base = createEmptyPlayState(snapshot);

    const fromMarta = resolveActiveNodeSceneContext(snapshot, {
      ...base,
      currentNodeId: "shared",
      traversal: ["start", "marta-branch", "shared"],
    });
    const fromGuard = resolveActiveNodeSceneContext(snapshot, {
      ...base,
      currentNodeId: "shared",
      traversal: ["start", "guard-branch", "shared"],
    });

    expect(fromMarta.presentCharacters?.characterIds).toEqual([marta.id]);
    expect(fromMarta.conversation?.characterIds).toEqual([marta.id]);
    expect(fromGuard.presentCharacters?.characterIds).toEqual([guard.id]);
    expect(fromGuard.conversation?.characterIds).toEqual([guard.id]);
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

    expect(resolveActiveNodeLocationContext(snapshot, state))
      .toEqual({ locationId: kitchen.id, sourceNodeId: "a" });
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
