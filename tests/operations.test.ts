import { describe, expect, it, vi } from "vitest";
import { addInventoryItem } from "../src/game/inventory";
import {
  createEmptyPlayState,
  reconcilePlayState,
  type ComputedDefinition,
  type ItemDefinition,
  type OperationHook,
  type VariableDefinition,
} from "../src/game/model";
import { executeOperation } from "../src/game/operations";
import { readComputedValue } from "../src/game/runtimeValues";
import { project } from "./fixtures";

const firstAndLaterHooks: OperationHook[] = [
  { id: "first", operation: "remove", order: 0, condition: { type: "attempt", operator: "eq", value: 1 }, responseText: "first {{computed:elapsed|integer}}", effects: [], success: false },
  { id: "later", operation: "remove", order: 1, condition: { type: "attempt", operator: "gte", value: 2 }, responseText: "later", effects: [], success: false },
];

const computed: ComputedDefinition = {
  id: "elapsed-definition", key: "elapsed", label: "Elapsed", source: "elapsed_seconds", format: "integer",
  showInStatus: true, interactable: true, operations: ["remove", "use"], hooks: firstAndLaterHooks,
};

const variable: VariableDefinition = {
  id: "count-definition", key: "count", label: "Count", valueType: "number", initialValue: 0,
  showInStatus: true, interactable: true, operations: ["use"], hooks: [{
    id: "count-use", operation: "use", order: 0, condition: { type: "always" }, responseText: "count {{variable:count|integer}}",
    effects: [
      { id: "increment", type: "increment", key: "count", amount: 1 },
      { id: "notify", type: "notification", text: "+{{variable:count|integer}}" },
    ], success: false,
  }],
};

const item: ItemDefinition = {
  id: "item-definition", key: "stone", name: "Stone", description: "A stone", assetPath: "", width: 1, height: 1,
  stackable: false, maxStack: 1, removable: false, startingQuantity: 0, interactable: true,
  operations: ["remove", "move"], tags: [], initialState: {}, hooks: firstAndLaterHooks,
};

describe("shared attempted-operation runtime", () => {
  it("does not apply revised starting inventory to an existing playthrough", () => {
    const original = project({ items: [item] });
    const existing = addInventoryItem(original, createEmptyPlayState(original), item.id, 1);
    const revised = project({ items: [{ ...item, startingQuantity: 3 }] });

    expect(reconcilePlayState(revised, existing).inventory).toHaveLength(1);
    expect(createEmptyPlayState(revised).inventory).toHaveLength(3);
  });

  it("dispatches a failed computed-value operation without mutating the computed value", () => {
    const snapshot = project({ computedValues: [computed] });
    const state = createEmptyPlayState(snapshot, 1_000);
    const before = readComputedValue(computed, snapshot, state, 5_000);
    const result = executeOperation(snapshot, state, { target: { kind: "computed", id: computed.id }, operation: "remove" }, 5_000);

    expect(result).toMatchObject({ accepted: false, attempt: 1, responseText: "first 4" });
    expect(readComputedValue(computed, snapshot, result.state, 5_000)).toBe(before);
  });

  it("selects first and subsequent hooks and survives play-state serialization", () => {
    const snapshot = project({ computedValues: [computed] });
    const state = createEmptyPlayState(snapshot, 1_000);
    const first = executeOperation(snapshot, state, { target: { kind: "computed", id: computed.id }, operation: "remove" }, 2_000);
    const restored = JSON.parse(JSON.stringify(first.state));
    const second = executeOperation(snapshot, restored, { target: { kind: "computed", id: computed.id }, operation: "remove" }, 2_000);

    expect([first.responseText, second.responseText]).toEqual(["first 1", "later"]);
    expect(second.state.attempts[second.eventKey]).toBe(2);
  });

  it("isolates counters by target identity and operation", () => {
    const snapshot = project({ variables: [variable], computedValues: [computed] });
    let state = createEmptyPlayState(snapshot);
    const computedRemove = executeOperation(snapshot, state, { target: { kind: "computed", id: computed.id }, operation: "remove" });
    state = computedRemove.state;
    const computedUse = executeOperation(snapshot, state, { target: { kind: "computed", id: computed.id }, operation: "use" });
    state = computedUse.state;
    const variableUse = executeOperation(snapshot, state, { target: { kind: "variable", id: variable.id }, operation: "use" });

    expect(variableUse.state.attempts).toMatchObject({
      [`computed:${computed.id}:remove`]: 1,
      [`computed:${computed.id}:use`]: 1,
      [`variable:${variable.id}:use`]: 1,
    });
  });

  it("runs ordered effects and interpolated notifications through the same dispatcher", () => {
    const snapshot = project({ variables: [variable] });
    const result = executeOperation(snapshot, createEmptyPlayState(snapshot), {
      target: { kind: "variable", id: variable.id }, operation: "use",
    });

    expect(result.state.values.count).toBe(1);
    expect(result.responseText).toBe("count 1");
    expect(result.events).toContainEqual({ type: "notification", text: "+1" });
  });

  it("keeps computed refreshes local", () => {
    const snapshot = project({ computedValues: [computed] });
    const state = createEmptyPlayState(snapshot, 1_000);
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      expect(readComputedValue(computed, snapshot, state, 2_000)).toBe(1);
      expect(readComputedValue(computed, snapshot, state, 3_000)).toBe(2);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
