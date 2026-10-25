import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_DEFAULTS, normalizeProjectDefaults } from "../src/engine/project/defaults";
import { normalizeProjectSettings } from "../src/engine/project/settings";
import { createDraftInteraction, createDraftOutcome } from "../src/features/narrative/drafts";
import { createNodeOpening } from "../src/features/narrative/nodeOpenings";
import { appendCaptureTurn, createCaptureInputFlow } from "../src/features/narrative/flow";
import { createRadixSequence, DEFAULT_RADIX_SEQUENCE } from "../src/features/radix/model";
import { newEntity } from "../src/features/world/author/entityDraft";

describe("project authoring defaults", () => {
  it("preserves the legacy 18 cps and other choices when a project has no defaults", () => {
    const settings = normalizeProjectSettings({});
    expect(settings.defaults).toEqual(DEFAULT_PROJECT_DEFAULTS);
    expect(createNodeOpening().narrationPerformance.charactersPerSecond).toBe(18);
    expect(createDraftInteraction("node").choiceVisibility).toBe("prompt");
    expect(settings.radix.sequenceDefaults).toEqual(DEFAULT_RADIX_SEQUENCE);
  });

  it("normalizes invalid and partial authoring defaults at the project boundary", () => {
    expect(normalizeProjectDefaults({ textSpeed: Number.POSITIVE_INFINITY, inputVisibility: "unknown" }))
      .toEqual(DEFAULT_PROJECT_DEFAULTS);
    expect(normalizeProjectDefaults({ textSpeed: 200, responseSelection: "random", inputVisibility: "typed" }))
      .toEqual({ textSpeed: 120, responseSelection: "random", inputVisibility: "typed" });
    expect(normalizeProjectDefaults({ textSpeed: 4.4 })).toMatchObject({ textSpeed: 4 });
  });

  it("seeds new Node, response, input and capture text without retroactively changing authored values", () => {
    const defaults = { textSpeed: 41, inputVisibility: "immediate" as const, responseSelection: "random" as const };
    const previous = createNodeOpening();
    const next = createNodeOpening(1, defaults.textSpeed);
    const input = createDraftInteraction("node", "hello", false, defaults);
    const fallback = createDraftInteraction("node", "", true, defaults);
    const extra = createDraftOutcome(1, "", defaults.textSpeed);
    const flow = createCaptureInputFlow(defaults.textSpeed);
    const appended = appendCaptureTurn(flow, defaults.textSpeed);
    expect(previous.narrationPerformance.charactersPerSecond).toBe(18);
    expect(next.narrationPerformance.charactersPerSecond).toBe(41);
    expect(next.dialoguePerformance.charactersPerSecond).toBe(41);
    expect(input.choiceVisibility).toBe("immediate");
    expect(input.outcomeSelection).toBe("random");
    expect(input.outcomes[0].responsePerformance.charactersPerSecond).toBe(41);
    expect(fallback.choiceVisibility).toBe("typed");
    expect(extra.dialoguePerformance?.charactersPerSecond).toBe(41);
    expect(flow.find((step) => step.type === "present" && step.responsePerformance.charactersPerSecond === 41)).toBeTruthy();
    expect(appended.filter((step) => step.type === "present")).toHaveLength(2);
  });

  it("normalizes owned defaults for characters, items, and State independently", () => {
    const settings = normalizeProjectSettings({
      worldDefaults: { characterStartingNameSelection: "random", interactable: true },
      itemDefaults: { width: 3, height: 2, stackable: true, maxStack: 9, startingQuantity: 0, equippedStorage: "slot" },
      variableDefaults: { flagValue: true, numberValue: 7, textValue: "ready", timeRate: 2, timeUnit: "minute" },
    });
    expect(settings.worldDefaults).toEqual({ characterStartingNameSelection: "random", interactable: true });
    expect(settings.itemDefaults).toMatchObject({
      width: 3, height: 2, stackable: true, maxStack: 9, startingQuantity: 0, equippedStorage: "slot",
    });
    expect(settings.variableDefaults).toMatchObject({
      flagValue: true, numberValue: 7, textValue: "ready", timeRate: 2, timeUnit: "minute",
    });
    expect(newEntity("character", settings.worldDefaults).startingNameSelection).toBe("random");
    expect(newEntity("location", settings.worldDefaults).interactable).toBe(true);
    const legacy = normalizeProjectSettings({});
    expect(legacy.worldDefaults).toMatchObject({ characterStartingNameSelection: "first", interactable: false });
    expect(legacy.itemDefaults).toMatchObject({ startingQuantity: 1, width: 1, stackable: false });
    expect(legacy.variableDefaults).toMatchObject({ flagValue: false, numberValue: 0, timeRate: 0 });
  });

  it("keeps original sequences while applying configured sort defaults only to new sequences", () => {
    const old = createRadixSequence();
    const updatedDefaults = normalizeProjectSettings({ radix: {
      sequenceDefaults: { ...DEFAULT_RADIX_SEQUENCE, arraySize: 512, volume: 0.3 },
    } }).radix.sequenceDefaults;
    const next = createRadixSequence(updatedDefaults);
    expect(old.arraySize).toBe(256);
    expect(old.volume).toBe(0.16);
    expect(next.arraySize).toBe(512);
    expect(next.volume).toBe(0.3);
    expect(next.id).not.toBe(old.id);
  });
});
