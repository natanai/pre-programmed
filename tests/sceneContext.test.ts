import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { makeSemanticReferenceToken, interpolateSemanticReferences } from "../src/engine/references/runtime";
import { parseCommand } from "../src/features/commands/parser";
import { resolveActiveNodeAnchor } from "../src/features/narrative/anchor";
import { executeInteraction } from "../src/features/narrative/runtime";
import {
  resolveActiveNodeContext,
  resolveActiveNodeConversationContext,
  resolveActiveNodeLocationContext,
} from "../src/features/narrative/sceneContext";
import { interaction, node, project } from "./fixtures";

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

describe("lightweight Node context", () => {
  it("carries only location and one conversation character through traversal", () => {
    const kitchen = location("kitchen", "Kitchen");
    const marta = character("marta", "Marta");
    const snapshot = project({
      startNodeId: "a",
      nodes: [
        {
          ...node("a", 1),
          locationMode: "set",
          locationId: kitchen.id,
          conversationMode: "clear",
          conversationCharacterId: null,
          anchor: { mode: "set", text: "ASK ABOUT THE LETTER" },
        },
        {
          ...node("b", 2),
          locationMode: "continue",
          locationId: null,
          conversationMode: "set",
          conversationCharacterId: marta.id,
          dialogueText: "What do you want?",
          anchor: { mode: "continue", text: "" },
        },
        {
          ...node("c", 3),
          locationMode: "continue",
          locationId: null,
          conversationMode: "continue",
          conversationCharacterId: null,
          anchor: { mode: "clear", text: "" },
        },
        {
          ...node("d", 4),
          locationMode: "clear",
          locationId: null,
          conversationMode: "clear",
          conversationCharacterId: null,
          anchor: { mode: "continue", text: "" },
        },
      ],
      entities: [kitchen, marta],
    });
    const base = createEmptyPlayState(snapshot);
    const talking = { ...base, currentNodeId: "b", traversal: ["a", "b"] };
    const anchorCleared = { ...base, currentNodeId: "c", traversal: ["a", "b", "c"] };
    const cleared = { ...base, currentNodeId: "d", traversal: ["a", "b", "c", "d"] };

    expect(resolveActiveNodeContext(snapshot, talking)).toEqual({
      location: { locationId: kitchen.id, sourceNodeId: "a" },
      conversation: { characterId: marta.id, sourceNodeId: "b" },
    });
    expect(resolveActiveNodeAnchor(snapshot, talking)?.text).toBe("ASK ABOUT THE LETTER");

    expect(resolveActiveNodeContext(snapshot, anchorCleared)).toEqual({
      location: { locationId: kitchen.id, sourceNodeId: "a" },
      conversation: { characterId: marta.id, sourceNodeId: "b" },
    });
    expect(resolveActiveNodeAnchor(snapshot, anchorCleared)).toBeNull();

    expect(resolveActiveNodeContext(snapshot, cleared)).toEqual({ location: null, conversation: null });
    expect(base).not.toHaveProperty("currentLocationId");
    expect(base).not.toHaveProperty("conversationCharacterId");
  });

  it("lets the same Continue Node inherit different location and conversation from real branches", () => {
    const kitchen = location("kitchen", "Kitchen");
    const alley = location("alley", "Back Alley");
    const marta = character("marta", "Marta");
    const guard = character("guard", "Guard");
    const snapshot = project({
      startNodeId: "start",
      nodes: [
        { ...node("start", 1) },
        {
          ...node("marta-branch", 2),
          locationMode: "set",
          locationId: kitchen.id,
          conversationMode: "set",
          conversationCharacterId: marta.id,
        },
        {
          ...node("guard-branch", 3),
          locationMode: "set",
          locationId: alley.id,
          conversationMode: "set",
          conversationCharacterId: guard.id,
        },
        {
          ...node("shared", 4),
          locationMode: "continue",
          locationId: null,
          conversationMode: "continue",
          conversationCharacterId: null,
        },
      ],
      entities: [kitchen, alley, marta, guard],
    });
    const base = createEmptyPlayState(snapshot);

    const fromMarta = resolveActiveNodeContext(snapshot, {
      ...base,
      currentNodeId: "shared",
      traversal: ["start", "marta-branch", "shared"],
    });
    const fromGuard = resolveActiveNodeContext(snapshot, {
      ...base,
      currentNodeId: "shared",
      traversal: ["start", "guard-branch", "shared"],
    });

    expect(fromMarta).toEqual({
      location: { locationId: kitchen.id, sourceNodeId: "marta-branch" },
      conversation: { characterId: marta.id, sourceNodeId: "marta-branch" },
    });
    expect(fromGuard).toEqual({
      location: { locationId: alley.id, sourceNodeId: "guard-branch" },
      conversation: { characterId: guard.id, sourceNodeId: "guard-branch" },
    });
  });

  it("makes current Character references follow the inherited conversation", () => {
    const marta = character("marta", "Marta");
    const snapshot = project({
      startNodeId: "a",
      nodes: [
        { ...node("a", 1), conversationMode: "set", conversationCharacterId: marta.id },
        { ...node("b", 2), conversationMode: "continue", conversationCharacterId: null },
      ],
      entities: [marta],
    });
    const state = { ...createEmptyPlayState(snapshot), currentNodeId: "b", traversal: ["a", "b"] };
    const name = makeSemanticReferenceToken("world.character", "current", "name");

    expect(resolveActiveNodeConversationContext(snapshot, state))
      .toEqual({ characterId: marta.id, sourceNodeId: "a" });
    expect(interpolateSemanticReferences(name, { snapshot, state })).toBe("Marta");

    const ask = interaction("ask", "b", "c");
    ask.outcomes[0] = {
      ...ask.outcomes[0],
      responseText: "You hesitate.",
      dialogueText: "Come with me.",
    };
    const withResponse = {
      ...snapshot,
      nodes: [...snapshot.nodes, { ...node("c", 3), conversationMode: "continue", conversationCharacterId: null }],
      interactions: [ask],
    };
    const execution = executeInteraction(withResponse, state, ask);
    expect(execution.responseText).toBe("You hesitate.");
    expect(execution.dialogueText).toBe("Come with me.");
    expect(execution.dialogueSpeakerId).toBe(marta.id);
    expect(execution.state.currentNodeId).toBe("c");
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
