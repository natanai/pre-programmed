import { describe, expect, it } from "vitest";
import {
  interpolateSemanticReferences,
  makeSemanticReferenceToken,
} from "../src/engine/references/runtime";
import { pickSeededInitializationValue } from "../src/engine/runtime/initializationRandom";
import {
  createEmptyPlayState,
  reconcilePlayStateAfterProjectChange,
} from "../src/engine/project/playState";
import { parseCommand } from "../src/features/commands/parser";
import { executeEffects } from "../src/engine/rules/executeEffects";
import { createRadixSequence } from "../src/features/radix/model";
import type { EntityDefinition } from "../src/features/world/model";
import { characterNameForPresentation, characterNameOptions } from "../src/features/world/playState";
import { aliasesFromInput, normalizedAliases } from "../src/features/world/author/aliasInput";
import { node, project } from "./fixtures";

function character(overrides: Partial<EntityDefinition> = {}): EntityDefinition {
  return {
    id: "guide",
    key: "guide",
    type: "character",
    name: "Evelyn",
    aliases: ["June", "Mae"],
    description: "A guide.",
    tags: [],
    portraitAssetId: null,
    interactable: true,
    operations: ["inspect"],
    hooks: [],
    ...overrides,
  };
}

function seededProject(seedValue = "12345") {
  const guide = character();
  const base = project({ entities: [guide] });
  const sequence = {
    ...createRadixSequence(),
    id: "startup-sort",
    seedMode: "number" as const,
    seedValue,
  };
  return {
    ...base,
    settings: {
      ...base.settings,
      radix: {
        ...base.settings.radix,
        sequences: [sequence],
        startup: { enabled: true, sequenceId: sequence.id },
      },
    },
  };
}

describe("seeded Character aliases", () => {
  it("uses the startup Sort seed to resolve one durable Character name", () => {
    const snapshot = seededProject();
    const first = createEmptyPlayState(snapshot, 1000);
    const second = createEmptyPlayState(snapshot, 2000);
    const expected = pickSeededInitializationValue(
      12345,
      "world.character:guide:name",
      ["Evelyn", "June", "Mae"],
    );

    expect(first.initializationSeed).toBe(12345);
    expect(second.initializationSeed).toBe(12345);
    expect(first.characterNames.guide).toBe(expected);
    expect(second.characterNames.guide).toBe(expected);

    const token = makeSemanticReferenceToken("world.character", "guide", "name");
    expect(interpolateSemanticReferences(token, { snapshot, state: first })).toBe(expected);
    expect(interpolateSemanticReferences(token, { snapshot, state: first, authorMode: true })).toBe("Evelyn");
  });

  it("does not reroll a Character name when authored Character data changes mid-run", () => {
    const snapshot = seededProject();
    const state = createEmptyPlayState(snapshot, 1000);
    const originalName = state.characterNames.guide;
    const changed = {
      ...snapshot,
      entities: [character({ aliases: ["Nora", "Alice", "Moth"] })],
    };

    const reconciled = reconcilePlayStateAfterProjectChange(snapshot, changed, state, 2000);
    expect(reconciled.characterNames.guide).toBe(originalName);
  });

  it("lets player commands target the active Character by this save's resolved name, not unused authored aliases", () => {
    const guide = character();
    const base = project({
      nodes: [{
        ...node("a", 1),
        conversationMode: "set",
        conversationCharacterId: guide.id,
      }],
      entities: [guide],
    });
    const snapshot = {
      ...base,
      settings: {
        ...base.settings,
        commands: {
          ...base.settings.commands,
          commands: [{
            id: "inspect-character",
            label: "Inspect",
            enabled: true,
            patterns: ["inspect {target}"],
            slots: [{ name: "target", sourceKinds: ["world.character"] }],
            action: { type: "target-operation" as const, operation: "inspect", targetSlot: "target" },
          }],
          referenceSources: [{
            sourceKind: "world.character",
            enabled: true,
            includeDefaults: true,
            aliases: {},
          }],
        },
      },
    };
    const initial = createEmptyPlayState(snapshot, 1000);
    const state = {
      ...initial,
      characterNames: { ...initial.characterNames, [guide.id]: "June" },
    };

    expect(parseCommand("inspect June", snapshot, state).invocation?.target)
      .toEqual({ kind: "world.entity", id: guide.id });
    expect(parseCommand("inspect Evelyn", snapshot, state).invocation).toBeNull();
    expect(parseCommand("inspect Mae", snapshot, state).invocation).toBeNull();
  });
});

describe("conditional Character aliases", () => {
  const hidden = {
    name: "Mysterious voice",
    condition: { type: "flag" as const, key: "knows_guide", value: false },
  };
  const seeded = { name: "June" };

  it("keeps conditional aliases out of world seed selection and reveals the canonical name without rerolling", () => {
    const guide = character({ aliases: [hidden, seeded] });
    const snapshot = project({ entities: [guide] });
    const initial = createEmptyPlayState(snapshot, 1000);
    const unrevealed = { ...initial, values: { ...initial.values, knows_guide: false } };
    const revealed = { ...initial, values: { ...initial.values, knows_guide: true } };
    const token = makeSemanticReferenceToken("world.character", guide.id, "name");

    expect(characterNameOptions(guide)).toEqual(["Evelyn", "June"]);
    expect(characterNameForPresentation(guide, unrevealed, false, snapshot)).toBe("Mysterious voice");
    expect(interpolateSemanticReferences(token, { snapshot, state: unrevealed })).toBe("Mysterious voice");
    expect(characterNameForPresentation(guide, revealed, false, snapshot)).toBe(initial.characterNames.guide);
    expect(interpolateSemanticReferences(token, { snapshot, state: revealed })).toBe(initial.characterNames.guide);
    expect(characterNameForPresentation(guide, unrevealed, true, snapshot)).toBe("Evelyn");
    expect(initial.characterNames.guide).toBe(revealed.characterNames.guide);
  });

  it("uses first matching conditional alias in authored order", () => {
    const guide = character({ aliases: [
      { name: "A distant voice", condition: { type: "always" } },
      { name: "Someone nearby", condition: { type: "always" } },
    ] });
    const snapshot = project({ entities: [guide] });
    const state = createEmptyPlayState(snapshot);
    expect(characterNameForPresentation(guide, state, false, snapshot)).toBe("A distant voice");
    expect(characterNameForPresentation(guide, state, true, snapshot)).toBe("Evelyn");
  });

  it("only offers the currently displayed name in player command matching", () => {
    const guide = character({ aliases: [hidden] });
    const base = project({
      nodes: [{ ...node("a", 1), conversationMode: "set", conversationCharacterId: guide.id }],
      entities: [guide],
    });
    const snapshot = { ...base, settings: { ...base.settings, commands: {
      ...base.settings.commands,
      commands: [{
        id: "inspect-character",
        label: "Inspect",
        enabled: true,
        patterns: ["inspect {target}"],
        slots: [{ name: "target", sourceKinds: ["world.character"] }],
        action: { type: "target-operation" as const, operation: "inspect", targetSlot: "target" },
      }],
      referenceSources: [{
        sourceKind: "world.character",
        enabled: true,
        includeDefaults: true,
        aliases: {},
      }],
    } } };
    const initial = createEmptyPlayState(snapshot);
    const unrevealed = { ...initial, values: { ...initial.values, knows_guide: false } };
    const revealed = { ...initial, values: { ...initial.values, knows_guide: true } };
    expect(parseCommand("inspect Mysterious voice", snapshot, unrevealed).invocation?.target)
      .toEqual({ kind: "world.entity", id: guide.id });
    expect(parseCommand("inspect Evelyn", snapshot, unrevealed).invocation).toBeNull();
    expect(parseCommand("inspect Evelyn", snapshot, revealed).invocation?.target)
      .toEqual({ kind: "world.entity", id: guide.id });
    expect(parseCommand("inspect Mysterious voice", snapshot, revealed).invocation).toBeNull();
  });
});

describe("Node-only Character reveal conditions", () => {
  it("supports an initially false node-only reveal flag without a separate default definition", () => {
    const guide = character({
      startingNameSelection: "first",
      aliases: [{ name: "Mysterious Voice", condition: {
        type: "flag", key: "hasasked", scope: "node", value: false,
      } }],
    });
    const snapshot = project({
      entities: [guide],
      nodes: [node("a", 1), node("b", 2)],
    });
    const firstRun = createEmptyPlayState(snapshot);
    const inFirstNode = { ...firstRun, currentNodeId: "a" };
    expect(inFirstNode.scopedValues.node.a?.hasasked).toBeUndefined();
    expect(characterNameForPresentation(guide, inFirstNode, false, snapshot)).toBe("Mysterious Voice");

    const asked = executeEffects(snapshot, inFirstNode, [{
      id: "reveal", type: "set_flag", key: "hasasked", scope: "node",
    }], { scope: { kind: "node", id: "a" } }).state;
    expect(characterNameForPresentation(guide, asked, false, snapshot)).toBe("Evelyn");
    // Node-scoped values remain independent when the run moves elsewhere.
    expect(characterNameForPresentation(guide, { ...asked, currentNodeId: "b" }, false, snapshot))
      .toBe("Mysterious Voice");
    expect(characterNameForPresentation(guide, { ...asked, currentNodeId: "a" }, false, snapshot))
      .toBe("Evelyn");
  });
});

describe("Alias textarea draft handling", () => {
  it("accepts spaces, returns, and unfinished blank lines", () => {
    expect(aliasesFromInput("Mysterious voice \n\nCaptain June\n", [])).toEqual([
      { name: "Mysterious voice" },
      { name: "Captain June" },
    ]);
  });

  it("preserves the associated condition on renaming and insertion", () => {
    const condition = { type: "flag" as const, key: "known", value: false };
    const original = [{ name: "Mysterious voice", condition }, { name: "June" }];
    expect(aliasesFromInput("Unknown speaker\nJune", original)).toEqual([
      { name: "Unknown speaker", condition },
      { name: "June" },
    ]);
    expect(aliasesFromInput("New voice\nMysterious voice\nJune", original)).toEqual([
      { name: "New voice" },
      { name: "Mysterious voice", condition },
      { name: "June" },
    ]);
  });

  it("normalizes saved names without removing distinct conditional definitions", () => {
    const condition = { type: "flag" as const, key: "known", value: false };
    expect(normalizedAliases(character({ aliases: [
      { name: " Mysterious voice ", condition },
      { name: "mysterious voice" },
      { name: "Evelyn" },
      { name: "June" },
    ] }))).toEqual([
      { name: "Mysterious voice", condition },
      { name: "June" },
    ]);
  });
});
