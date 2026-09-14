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
import { createRadixSequence } from "../src/features/radix/model";
import type { EntityDefinition } from "../src/features/world/model";
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
