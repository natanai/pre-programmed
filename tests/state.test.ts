import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../src/game/conditions";
import { executeEffects } from "../src/game/effects";
import { interpolateText } from "../src/game/interpolation";
import { createEmptyPlayState, reconcilePlayState, type Interaction } from "../src/game/model";
import { executeInteraction } from "../src/game/runtime";
import { advanceTimedVariables } from "../src/game/timedVariables";
import { project } from "./fixtures";

const snapshot = project({
  variables: [{ id: "v", key: "count", label: "Count", valueType: "number", initialValue: 0, showInStatus: true, interactable: false, operations: [], hooks: [] }],
  computedValues: [{ id: "c", key: "elapsed", label: "Elapsed", source: "elapsed_seconds", format: "integer", showInStatus: true, interactable: false, operations: [], hooks: [] }],
});

describe("conditions, effects, counters, and interpolation", () => {
  it("adds newly authored variable defaults to an active play state without resetting existing values", () => {
    const original = project({ variables: [{ id: "old", key: "old", label: "Old", valueType: "number", initialValue: 1, showInStatus: false, interactable: false, operations: [], hooks: [] }] });
    const state = { ...createEmptyPlayState(original), values: { old: 9 } };
    const expanded = project({ variables: [
      ...original.variables,
      { id: "new", key: "new", label: "New", valueType: "number", initialValue: 4, showInStatus: false, interactable: false, operations: [], hooks: [] },
    ] });

    expect(reconcilePlayState(expanded, state).values).toEqual({ old: 9, new: 4 });

    const timed = project({ variables: [{
      id: "drain", key: "drain", label: "Drain", valueType: "number", initialValue: 10,
      showInStatus: false, interactable: false, operations: [], hooks: [], timeRate: -2, timeUnit: "minute",
    }] });
    const advanced = advanceTimedVariables(timed, createEmptyPlayState(timed, 1_000), 61_000);
    expect(advanced.values.drain).toBe(8);
  });

  it("evaluates variable comparisons and logical groups", () => {
    const state = { ...createEmptyPlayState(snapshot), values: { count: 3 } };
    expect(evaluateCondition({ type: "all", conditions: [
      { type: "variable", key: "count", operator: "gte", value: 3 },
      { type: "not", condition: { type: "flag", key: "closed", value: true } },
    ] }, { snapshot, state })).toBe(true);
  });

  it("executes effects in authored order", () => {
    const state = createEmptyPlayState(snapshot);
    const result = executeEffects(snapshot, state, [
      { id: "1", type: "set_value", key: "count", value: 5 },
      { id: "2", type: "increment", key: "count", amount: 2 },
      { id: "3", type: "decrement", key: "count", amount: 1 },
    ]);
    expect(result.state.values.count).toBe(6);
  });

  it("increments engine-owned attempts before selecting first/subsequent outcomes", () => {
    const interaction: Interaction = {
      id: "try", sourceNodeId: "a", wording: "try", choiceVisibility: "prompt", aliases: ["try"], tags: [], notes: "",
      outcomes: [
        { id: "first", order: 0, label: "first", authorStatus: "configured", condition: { type: "attempt", operator: "eq", value: 1 }, responseText: "first", effects: [], disposition: "stay", destinationNodeId: null },
        { id: "later", order: 1, label: "later", authorStatus: "configured", condition: { type: "attempt", operator: "gte", value: 2 }, responseText: "later", effects: [], disposition: "stay", destinationNodeId: null },
      ],
    };
    const first = executeInteraction(snapshot, createEmptyPlayState(snapshot), interaction);
    const second = executeInteraction(snapshot, first.state, interaction);
    expect([first.responseText, second.responseText]).toEqual(["first", "later"]);
    expect(second.state.attempts["interaction:try"]).toBe(2);
  });

  it("allows an ordered transition effect to move play even when the outcome disposition stays", () => {
    const destinationSnapshot = project({ nodes: [
      { id: "a", nodeNumber: 1, text: "start", ending: false, tags: [], characterId: null, locationId: null, performance: { charactersPerSecond: 18, cues: [] } },
      { id: "b", nodeNumber: 2, text: "destination", ending: false, tags: [], characterId: null, locationId: null, performance: { charactersPerSecond: 18, cues: [] } },
    ] });
    const interaction: Interaction = {
      id: "effect-transition", sourceNodeId: "a", wording: "move", choiceVisibility: "prompt", aliases: ["move"], tags: [], notes: "",
      outcomes: [{
        id: "effect-outcome", order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "moving",
        effects: [{ id: "transition", type: "transition", nodeId: "b" }], disposition: "stay", destinationNodeId: null,
      }],
    };
    const result = executeInteraction(destinationSnapshot, createEmptyPlayState(destinationSnapshot), interaction);
    expect(result.state.currentNodeId).toBe("b");
    expect(result.state.traversal).toEqual(["a", "b"]);
  });

  it("interpolates validated values and fails missing or executable text safely", () => {
    const state = { ...createEmptyPlayState(snapshot, 1_000), values: { count: 4 } };
    expect(interpolateText("{{variable:count|integer}} / {{computed:elapsed|integer}}", { snapshot, state, now: 4_500 })).toBe("4 / 4");
    expect(interpolateText("{{variable:missing}} {{constructor.constructor('return 1')()}}", { snapshot, state })).toBe(" {{constructor.constructor('return 1')()}}");
  });
});
