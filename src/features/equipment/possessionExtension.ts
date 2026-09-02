import type { PossessionExtension } from "../../engine/possessions/extensions";
import { equipInventoryInstance, equipmentRule, unequipInventoryInstance } from "./runtime";

function requestedSlot(argumentsValue: Parameters<NonNullable<PossessionExtension["applyItemOperation"]>>[0]["arguments"]) {
  const argument = argumentsValue?.slot;
  return argument?.kind === "text" ? argument.value : "";
}

export const EQUIPMENT_POSSESSION_EXTENSION: PossessionExtension = {
  id: "equipment",
  applyItemOperation({ snapshot, state, target, operation, arguments: argumentsValue, services }) {
    if (target.kind !== "item") return null;
    if (operation === "equip") return equipInventoryInstance(snapshot, state, target.id, requestedSlot(argumentsValue), services);
    if (operation === "unequip") return unequipInventoryInstance(snapshot, state, target.id, services);
    return null;
  },
  afterGrant(snapshot, before, after, itemId, services) {
    const slotKey = equipmentRule(snapshot, itemId)?.equipOnGiveSlotKey;
    if (!slotKey) return after;
    const previousIds = new Set(before.inventory.map((entry) => entry.instanceId));
    const added = after.inventory.find((entry) => entry.itemId === itemId && !previousIds.has(entry.instanceId));
    if (!added) return after;
    const result = equipInventoryInstance(snapshot, after, added.instanceId, slotKey, services);
    return result.accepted ? result.state : after;
  },
  afterRemove(_snapshot, _before, after, removedInstanceIds) {
    if (!removedInstanceIds.length) return after;
    const removed = new Set(removedInstanceIds);
    return {
      ...after,
      equipmentAssignments: Object.fromEntries(Object.entries(after.equipmentAssignments).filter(([, instanceId]) => !removed.has(instanceId))),
    };
  },
};
