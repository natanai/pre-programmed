import { describe, expect, it } from "vitest";
import type { PlayState, ProjectSnapshot } from "../src/engine/project/model";
import { createEmptyPlayState } from "../src/engine/project/playState";
import type { BodyBackgroundDefinition, InventoryEntry, ItemDefinition } from "../src/features/inventory/model";
import { reconcileInventoryPlayState } from "../src/features/inventory/playState";
import {
  compatibleBodySlots,
  equipInventoryEntry,
  setActiveBodyType,
} from "../src/features/inventory/runtime";
import { project } from "./fixtures";

function slot(key: string, name = key) {
  return { id: `slot-${key}`, key, name, x: 0, y: 0, width: 20, height: 20 };
}

function body(
  id: string,
  slotKeys: string[],
  startingEquipment: BodyBackgroundDefinition["startingEquipment"] = [],
): BodyBackgroundDefinition {
  return {
    id,
    name: id,
    assetId: "",
    slots: slotKeys.map((key) => slot(key)),
    startingEquipment,
  };
}

function item(
  id: string,
  options: Partial<ItemDefinition> = {},
): ItemDefinition {
  return {
    id,
    key: id,
    name: id,
    description: id,
    assetId: "",
    width: 1,
    height: 1,
    stackable: false,
    maxStack: 1,
    removable: true,
    startingQuantity: 0,
    interactable: true,
    operations: ["inspect", "move", "equip", "unequip"],
    equipmentPlacements: [],
    equippedStorage: "inventory",
    equipOnGiveSlotKey: null,
    tags: [],
    initialState: {},
    hooks: [],
    ...options,
  };
}

function inventoryEntry(
  instanceId: string,
  itemId: string,
  equipment: InventoryEntry["equipment"] = null,
  x = 0,
  y = 0,
): InventoryEntry {
  return { instanceId, itemId, quantity: 1, x, y, equipment, state: {} };
}

function snapshotWith(items: ItemDefinition[], bodies: BodyBackgroundDefinition[], startingBodyBackgroundId = bodies[0]?.id ?? null) {
  return project({ items, bodyBackgrounds: bodies, startingBodyBackgroundId }) as ProjectSnapshot;
}

function playState(snapshot: ProjectSnapshot, inventory: InventoryEntry[]): PlayState {
  return { ...createEmptyPlayState(snapshot, 1_000), inventory, bodyBackgroundId: snapshot.startingBodyBackgroundId };
}

const twoHandPlacements = [
  { anchorSlotKey: "left", occupiedSlotKeys: ["left", "right"] },
  { anchorSlotKey: "right", occupiedSlotKeys: ["left", "right"] },
];

describe("Inventory multi-slot equipment", () => {
  it("models symmetric placements without hard-wiring a two-handed item type", () => {
    const sword = item("sword", { equipmentPlacements: twoHandPlacements });
    const snapshot = snapshotWith([sword], [body("body", ["left", "right", "torso"])]);
    const initial = playState(snapshot, [inventoryEntry("sword-1", sword.id)]);

    expect(compatibleBodySlots(snapshot, initial, sword).map((candidate) => candidate.key)).toEqual(["left", "right"]);

    const left = equipInventoryEntry(snapshot, initial, "sword-1", "left");
    expect(left.inventory[0].equipment).toEqual({
      anchorSlotKey: "left",
      occupiedSlotKeys: ["left", "right"],
    });

    const right = equipInventoryEntry(snapshot, left, "sword-1", "right");
    expect(right.inventory[0].equipment).toEqual({
      anchorSlotKey: "right",
      occupiedSlotKeys: ["left", "right"],
    });
  });

  it("only offers placements whose complete occupied set exists on the active body", () => {
    const armor = item("armor", {
      equipmentPlacements: [
        { anchorSlotKey: "torso", occupiedSlotKeys: ["torso", "left", "right"] },
        { anchorSlotKey: "head", occupiedSlotKeys: ["head"] },
      ],
    });
    const snapshot = snapshotWith([armor], [body("body", ["torso", "left", "head"])]);
    const state = playState(snapshot, [inventoryEntry("armor-1", armor.id)]);

    expect(compatibleBodySlots(snapshot, state, armor).map((candidate) => candidate.key)).toEqual(["head"]);
    expect(equipInventoryEntry(snapshot, state, "armor-1", "torso")).toBe(state);
  });

  it("displaces every conflicting equipped instance as one atomic equip transaction", () => {
    const sword = item("sword", { equipmentPlacements: twoHandPlacements, equippedStorage: "slot" });
    const glove = item("glove", { equippedStorage: "slot" });
    const snapshot = snapshotWith([sword, glove], [body("body", ["left", "right"])]);
    const state = playState(snapshot, [
      inventoryEntry("sword-1", sword.id),
      inventoryEntry("left-glove", glove.id, { anchorSlotKey: "left", occupiedSlotKeys: ["left"] }),
      inventoryEntry("right-glove", glove.id, { anchorSlotKey: "right", occupiedSlotKeys: ["right"] }),
    ]);

    const equipped = equipInventoryEntry(snapshot, state, "sword-1", "left");

    expect(equipped).not.toBe(state);
    expect(equipped.inventory.find((entry) => entry.instanceId === "sword-1")?.equipment?.occupiedSlotKeys).toEqual(["left", "right"]);
    expect(equipped.inventory.find((entry) => entry.instanceId === "left-glove")?.equipment).toBeNull();
    expect(equipped.inventory.find((entry) => entry.instanceId === "right-glove")?.equipment).toBeNull();
    const returned = equipped.inventory.filter((entry) => entry.instanceId.includes("glove"));
    expect(new Set(returned.map((entry) => `${entry.x}:${entry.y}`)).size).toBe(2);
  });

  it("rolls the entire equip back when displaced slot-only gear cannot return to a full grid", () => {
    const sword = item("sword", {
      equipmentPlacements: [
        ...twoHandPlacements,
        { anchorSlotKey: "torso", occupiedSlotKeys: ["torso"] },
      ],
      equippedStorage: "slot",
    });
    const glove = item("glove", { equippedStorage: "slot" });
    const filler = item("filler");
    const snapshot = snapshotWith([sword, glove, filler], [body("body", ["left", "right", "torso"])]);
    const fullGrid = Array.from({ length: 60 }, (_, index) => inventoryEntry(
      `filler-${index}`,
      filler.id,
      null,
      index % 10,
      Math.floor(index / 10),
    ));
    const state = playState(snapshot, [
      ...fullGrid,
      inventoryEntry("sword-1", sword.id, { anchorSlotKey: "torso", occupiedSlotKeys: ["torso"] }),
      inventoryEntry("left-glove", glove.id, { anchorSlotKey: "left", occupiedSlotKeys: ["left"] }),
      inventoryEntry("right-glove", glove.id, { anchorSlotKey: "right", occupiedSlotKeys: ["right"] }),
    ]);

    const attempted = equipInventoryEntry(snapshot, state, "sword-1", "left");

    expect(attempted).toBe(state);
    expect(attempted.inventory.find((entry) => entry.instanceId === "sword-1")?.equipment?.anchorSlotKey).toBe("torso");
    expect(attempted.inventory.find((entry) => entry.instanceId === "left-glove")?.equipment?.anchorSlotKey).toBe("left");
  });

  it("prevents overlapping multi-slot starting loadouts while preserving total starting quantity", () => {
    const sword = item("sword", { equipmentPlacements: twoHandPlacements, equippedStorage: "slot", startingQuantity: 1 });
    const ring = item("ring", { startingQuantity: 1 });
    const startBody = body("body", ["left", "right"], [
      { slotKey: "left", itemId: sword.id },
      { slotKey: "right", itemId: ring.id },
    ]);
    const snapshot = snapshotWith([sword, ring], [startBody]);

    const state = createEmptyPlayState(snapshot, 1_000);
    const swordEntry = state.inventory.find((entry) => entry.itemId === sword.id);
    const ringEntry = state.inventory.find((entry) => entry.itemId === ring.id);

    expect(swordEntry?.equipment?.occupiedSlotKeys).toEqual(["left", "right"]);
    expect(ringEntry?.equipment).toBeNull();
    expect(state.inventory.filter((entry) => entry.itemId === ring.id).reduce((sum, entry) => sum + entry.quantity, 0)).toBe(1);
  });

  it("expands legacy single-slot play state into the authored placement during reconciliation", () => {
    const sword = item("sword", { equipmentPlacements: twoHandPlacements, equippedStorage: "slot" });
    const snapshot = snapshotWith([sword], [body("body", ["left", "right"])]);
    const base = playState(snapshot, []);
    const legacyEntry = {
      instanceId: "sword-1",
      itemId: sword.id,
      quantity: 1,
      x: 0,
      y: 0,
      equippedSlotKey: "left",
      state: {},
    } as unknown as InventoryEntry;

    const reconciled = reconcileInventoryPlayState(snapshot, { ...base, inventory: [legacyEntry] });
    const entry = reconciled.inventory[0];

    expect(entry.equipment).toEqual({ anchorSlotKey: "left", occupiedSlotKeys: ["left", "right"] });
    expect(Object.prototype.hasOwnProperty.call(entry, "equippedSlotKey")).toBe(false);
  });

  it("unequips safely when a body change removes part of the active placement", () => {
    const sword = item("sword", { equipmentPlacements: twoHandPlacements, equippedStorage: "slot" });
    const snapshot = snapshotWith([sword], [
      body("two-hands", ["left", "right"]),
      body("no-hands", ["torso"]),
    ], "two-hands");
    const state = playState(snapshot, [
      inventoryEntry("sword-1", sword.id, { anchorSlotKey: "left", occupiedSlotKeys: ["left", "right"] }),
    ]);

    const changed = setActiveBodyType(snapshot, state, "no-hands");

    expect(changed.bodyBackgroundId).toBe("no-hands");
    expect(changed.inventory[0].equipment).toBeNull();
  });
});
