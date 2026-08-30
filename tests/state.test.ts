import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../src/game/conditions";
import { executeEffects } from "../src/game/effects";
import { interpolateText } from "../src/game/interpolation";
import { createEmptyPlayState, type Interaction } from "../src/game/model";
import { executeInteraction } from "../src/game/runtime";
import { project } from "./fixtures";

const snapshot = project({
  variables: [{ id: "v", key: "count", label: "Count", valueType: "number", initialValue: 0, showInStatus: true }],
  computedValues: [{ id: "c", key: "elapsed", label: "Elapsed", source: "elapsed_seconds", format: "integer", showInStatus: true }],
});

describe("conditions, effects, counters, and interpolation", () => {
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
      id: "try", sourceNodeId: "a", wording: "try", aliases: ["try"], tags: [], notes: "",
      outcomes: [
        { id: "first", order: 0, label: "first", condition: { type: "attempt", operator: "eq", value: 1 }, responseText: "first", effects: [], disposition: "stay", destinationNodeId: null },
        { id: "later", order: 1, label: "later", condition: { type: "attempt", operator: "gte", value: 2 }, responseText: "later", effects: [], disposition: "stay", destinationNodeId: null },
      ],
    };
    const first = executeInteraction(snapshot, createEmptyPlayState(snapshot), interaction);
    const second = executeInteraction(snapshot, first.state, interaction);
    expect([first.responseText, second.responseText]).toEqual(["first", "later"]);
    expect(second.state.attempts["interaction:try"]).toBe(2);
  });

  it("interpolates validated values and fails missing or executable text safely", () => {
    const state = { ...createEmptyPlayState(snapshot, 1_000), values: { count: 4 } };
    expect(interpolateText("{{variable:count|integer}} / {{computed:elapsed|integer}}", { snapshot, state, now: 4_500 })).toBe("4 / 4");
    expect(interpolateText("{{variable:missing}} {{constructor.constructor('return 1')()}}", { snapshot, state })).toBe(" {{constructor.constructor('return 1')()}}");
  });
});
