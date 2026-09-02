import { describe, expect, it } from "vitest";
import { executeEffects } from "../src/engine/rules/executeEffects";
import { createEmptyPlayState, reconcilePlayStateAfterProjectChange } from "../src/engine/project/playState";
import type { ItemDefinition } from "../src/features/inventory/model";
import { addInventoryItem, canPlaceItem, entryOccupiesInventoryGrid, giveInventoryItem } from "../src/features/inventory/runtime";
import { attemptOperation, executeOperation, formatOperationOutput } from "../src/features/operations/runtime";
import { project } from "./fixtures";

const item: ItemDefinition = {
  id: "box", key: "box", name: "Box", description: "A box", assetId: "", width: 2, height: 2,
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

  it("reconciles a newly authored Inventory default through the generic project-change lifecycle", () => {
    const previous = project({ items: [] });
    const next = project({ items: [{ ...item, startingQuantity: 2 }] });
    const current = createEmptyPlayState(previous);
    const placed = reconcilePlayStateAfterProjectChange(previous, next, current);
    const repeated = reconcilePlayStateAfterProjectChange(previous, next, placed);

    expect(placed.inventory).toHaveLength(2);
    expect(repeated.inventory).toHaveLength(2);
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
    const inspected = executeOperation(snapshot, state, { operation: "inspect", target: { kind: "item", id: instanceId } });
    const first = attemptOperation(snapshot, state, { operation: "remove", target: { kind: "item", id: instanceId } });
    const second = attemptOperation(snapshot, first.state, { operation: "remove", target: { kind: "item", id: instanceId } });
    expect(formatOperationOutput(inspected, state)).toBe("[INSPECT > Box] A box");
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

  it("starts with the authored body type and equips loadout instances from starting quantity", () => {
    const wearable: ItemDefinition = {
      ...item,
      id: "glove",
      key: "glove",
      name: "Glove",
      startingQuantity: 2,
      operations: ["inspect", "equip", "unequip"],
      equipmentSlotKeys: ["hand"],
      equippedStorage: "slot",
    };
    const loadoutSnapshot = project({
      items: [wearable],
      startingBodyBackgroundId: "adult",
      bodyBackgrounds: [{
        id: "adult",
        name: "Adult",
        assetId: "",
        slots: [{ id: "hand-slot", key: "hand", name: "Hand", x: 10, y: 10, width: 20, height: 20 }],
        startingEquipment: [{ slotKey: "hand", itemId: wearable.id }],
      }],
    });

    const state = createEmptyPlayState(loadoutSnapshot);
    expect(state.bodyBackgroundId).toBe("adult");
    expect(state.inventory).toHaveLength(2);
    expect(state.inventory.reduce((total, entry) => total + entry.quantity, 0)).toBe(2);
    expect(state.inventory.filter((entry) => entry.equippedSlotKey === "hand")).toHaveLength(1);
  });

  it("auto-equips a newly granted instance and safely replaces the prior slot occupant", () => {
    const naturalLeg: ItemDefinition = {
      ...item,
      id: "natural-leg",
      key: "natural_leg",
      name: "Natural Leg",
      width: 1,
      height: 1,
      startingQuantity: 1,
      equipmentSlotKeys: ["leg"],
      equippedStorage: "slot",
    };
    const cyberLeg: ItemDefinition = {
      ...item,
      id: "cyber-leg",
      key: "cyber_leg",
      name: "Cyber Leg",
      width: 1,
      height: 1,
      startingQuantity: 0,
      equipmentSlotKeys: ["leg"],
      equippedStorage: "slot",
      equipOnGiveSlotKey: "leg",
    };
    const body = {
      id: "body",
      name: "Body",
      assetId: "",
      slots: [{ id: "leg-slot", key: "leg", name: "Leg", x: 10, y: 10, width: 20, height: 20 }],
      startingEquipment: [{ slotKey: "leg", itemId: naturalLeg.id }],
    };
    const grantSnapshot = project({
      items: [naturalLeg, cyberLeg],
      startingBodyBackgroundId: body.id,
      bodyBackgrounds: [body],
    });
    const before = createEmptyPlayState(grantSnapshot);
    const naturalInstanceId = before.inventory[0].instanceId;
    const after = executeEffects(grantSnapshot, before, [{
      id: "grant-cyber-leg",
      type: "give_item",
      itemId: cyberLeg.id,
      quantity: 1,
    }]).state;

    expect(after.inventory).toHaveLength(2);
    expect(after.inventory.find((entry) => entry.itemId === cyberLeg.id)?.equippedSlotKey).toBe("leg");
    expect(after.inventory.find((entry) => entry.instanceId === naturalInstanceId)?.equippedSlotKey).toBeNull();
    expect(after.inventory.filter((entry) => entry.equippedSlotKey === "leg")).toHaveLength(1);
  });

  it("does not apply equip-on-give rules to authored starting quantities", () => {
    const cyberLeg: ItemDefinition = {
      ...item,
      id: "cyber-leg",
      key: "cyber_leg",
      name: "Cyber Leg",
      width: 1,
      height: 1,
      startingQuantity: 1,
      equipmentSlotKeys: ["leg"],
      equippedStorage: "slot",
      equipOnGiveSlotKey: "leg",
    };
    const startSnapshot = project({
      items: [cyberLeg],
      startingBodyBackgroundId: "body",
      bodyBackgrounds: [{
        id: "body",
        name: "Body",
        assetId: "",
        slots: [{ id: "leg-slot", key: "leg", name: "Leg", x: 10, y: 10, width: 20, height: 20 }],
      }],
    });

    const state = createEmptyPlayState(startSnapshot);
    expect(state.inventory).toHaveLength(1);
    expect(state.inventory[0].equippedSlotKey).toBeNull();
  });

  it("refuses an unsafe auto-equip replacement without losing either existing item", () => {
    const naturalLeg: ItemDefinition = {
      ...item,
      id: "natural-leg",
      key: "natural_leg",
      name: "Natural Leg",
      width: 1,
      height: 1,
      startingQuantity: 1,
      equipmentSlotKeys: ["leg"],
      equippedStorage: "slot",
    };
    const cyberLeg: ItemDefinition = {
      ...naturalLeg,
      id: "cyber-leg",
      key: "cyber_leg",
      name: "Cyber Leg",
      startingQuantity: 0,
      equipOnGiveSlotKey: "leg",
    };
    const blocker: ItemDefinition = {
      ...item,
      id: "full-grid",
      key: "full_grid",
      name: "Full Grid",
      width: 10,
      height: 6,
      startingQuantity: 1,
    };
    const fullSnapshot = project({
      items: [naturalLeg, cyberLeg, blocker],
      startingBodyBackgroundId: "body",
      bodyBackgrounds: [{
        id: "body",
        name: "Body",
        assetId: "",
        slots: [{ id: "leg-slot", key: "leg", name: "Leg", x: 10, y: 10, width: 20, height: 20 }],
        startingEquipment: [{ slotKey: "leg", itemId: naturalLeg.id }],
      }],
    });
    const before = createEmptyPlayState(fullSnapshot);
    const after = giveInventoryItem(fullSnapshot, before, cyberLeg.id, 1);

    expect(after.inventory).toHaveLength(before.inventory.length);
    expect(after.inventory.some((entry) => entry.itemId === cyberLeg.id)).toBe(false);
    expect(after.inventory.find((entry) => entry.itemId === naturalLeg.id)?.equippedSlotKey).toBe("leg");
    expect(after.inventory.some((entry) => entry.itemId === blocker.id)).toBe(true);
  });

  it("lets slot-carried equipment free grid capacity and refuses unsafe unequip", () => {
    const wearable: ItemDefinition = {
      ...item,
      id: "cyber-leg",
      key: "cyber_leg",
      name: "Cyber Leg",
      width: 1,
      height: 1,
      startingQuantity: 1,
      operations: ["inspect", "equip", "unequip"],
      equipmentSlotKeys: ["leg"],
      equippedStorage: "slot",
    };
    const blocker: ItemDefinition = {
      ...item,
      id: "full-grid",
      key: "full_grid",
      name: "Full Grid",
      width: 10,
      height: 6,
      startingQuantity: 1,
    };
    const fullSnapshot = project({
      items: [wearable, blocker],
      startingBodyBackgroundId: "body",
      bodyBackgrounds: [{
        id: "body",
        name: "Body",
        assetId: "",
        slots: [{ id: "leg-slot", key: "leg", name: "Leg", x: 10, y: 10, width: 20, height: 20 }],
        startingEquipment: [{ slotKey: "leg", itemId: wearable.id }],
      }],
    });
    const state = createEmptyPlayState(fullSnapshot);
    const equipped = state.inventory.find((entry) => entry.itemId === wearable.id)!;
    expect(entryOccupiesInventoryGrid(fullSnapshot, equipped)).toBe(false);
    expect(state.inventory.some((entry) => entry.itemId === blocker.id)).toBe(true);

    const result = executeOperation(fullSnapshot, state, {
      operation: "unequip",
      target: { kind: "item", id: equipped.instanceId },
    });
    expect(result.accepted).toBe(false);
    expect(result.responseText).toBe("No inventory space to unequip.");
    expect(result.state.inventory.find((entry) => entry.instanceId === equipped.instanceId)?.equippedSlotKey).toBe("leg");
  });

  it("does not retrofit a newly authored starting loadout onto an existing playthrough", () => {
    const wearable = { ...item, startingQuantity: 1, operations: ["inspect", "equip", "unequip"] as const };
    const body = {
      id: "body",
      name: "Body",
      assetId: "",
      slots: [{ id: "hand-slot", key: "hand", name: "Hand", x: 10, y: 10, width: 20, height: 20 }],
    };
    const previous = project({ items: [wearable], bodyBackgrounds: [body], startingBodyBackgroundId: "body" });
    const next = project({
      items: [wearable],
      bodyBackgrounds: [{ ...body, startingEquipment: [{ slotKey: "hand", itemId: wearable.id }] }],
      startingBodyBackgroundId: "body",
    });
    const current = createEmptyPlayState(previous);
    const reconciled = reconcilePlayStateAfterProjectChange(previous, next, current);
    expect(reconciled.inventory[0].equippedSlotKey).toBeNull();
  });
});
