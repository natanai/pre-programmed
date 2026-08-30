import { describe, expect, it } from "vitest";
import { addInventoryItem, canPlaceItem } from "../src/game/inventory";
import { createEmptyPlayState, type ItemDefinition } from "../src/game/model";
import { attemptOperation } from "../src/game/operations";
import { project } from "./fixtures";

const item: ItemDefinition = {
  id: "box", key: "box", name: "Box", description: "A box", assetPath: "", width: 2, height: 2,
  stackable: false, maxStack: 1, removable: false, startingQuantity: 0, interactable: true,
  operations: ["inspect", "use", "move", "remove"], tags: [], initialState: {}, hooks: [
    { id: "drop-first", operation: "remove", order: 0, condition: { type: "attempt", operator: "eq", value: 1 }, responseText: "first refusal", effects: [], success: false },
    { id: "drop-later", operation: "remove", order: 1, condition: { type: "attempt", operator: "gte", value: 2 }, responseText: "later refusal", effects: [], success: false },
  ],
};
const snapshot = project({ items: [item] });

describe("inventory engine", () => {
  it("places author-defined starting quantities into a new playthrough", () => {
    const startingItem = { ...item, startingQuantity: 2 };
    const startingSnapshot = project({ items: [startingItem] });
    const state = createEmptyPlayState(startingSnapshot);
    expect(state.inventory).toHaveLength(2);
    expect(state.inventory.every((entry) => entry.itemId === item.id)).toBe(true);
  });

  it("validates physical placement and rejects collisions", () => {
    const state = addInventoryItem(snapshot, createEmptyPlayState(snapshot), item.id, 1);
    expect(canPlaceItem(snapshot, state.inventory, item, 9, 5)).toBe(false);
    expect(canPlaceItem(snapshot, state.inventory, item, 0, 0)).toBe(false);
    expect(canPlaceItem(snapshot, state.inventory, item, 2, 0)).toBe(true);
  });

  it("fires hooks for disallowed manipulation and varies them by attempt", () => {
    const state = addInventoryItem(snapshot, createEmptyPlayState(snapshot), item.id, 1);
    const instanceId = state.inventory[0].instanceId;
    const first = attemptOperation(snapshot, state, { operation: "remove", target: { kind: "item", id: instanceId } });
    const second = attemptOperation(snapshot, first.state, { operation: "remove", target: { kind: "item", id: instanceId } });
    expect(first).toMatchObject({ accepted: false, responseText: "first refusal", attempt: 1 });
    expect(second).toMatchObject({ accepted: false, responseText: "later refusal", attempt: 2 });
    expect(second.state.inventory).toHaveLength(1);
  });

  it("uses the same move operation for pointer drag and tap-selected placement", () => {
    const state = addInventoryItem(snapshot, createEmptyPlayState(snapshot), item.id, 1);
    const request = { operation: "move" as const, target: { kind: "item" as const, id: state.inventory[0].instanceId }, placement: { x: 3, y: 2 } };
    const dragResult = attemptOperation(snapshot, state, request);
    const tapResult = attemptOperation(snapshot, state, request);
    expect(dragResult.state.inventory[0]).toMatchObject({ x: 3, y: 2 });
    expect(tapResult.state.inventory[0]).toMatchObject({ x: 3, y: 2 });
  });
});
