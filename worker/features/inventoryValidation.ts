import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function validStringArray(value: unknown) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0);
}

function validBodySlots(value: unknown) {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const slot of value) {
    if (!object(slot)) return false;
    if (typeof slot.id !== "string" || !slot.id || ids.has(slot.id)) return false;
    if (typeof slot.key !== "string" || !slot.key.trim() || keys.has(slot.key)) return false;
    if (typeof slot.name !== "string" || !slot.name.trim()) return false;
    ids.add(slot.id);
    keys.add(slot.key);

    const { x, y, width, height } = slot;
    if (
      typeof x !== "number" || !Number.isFinite(x)
      || typeof y !== "number" || !Number.isFinite(y)
      || typeof width !== "number" || !Number.isFinite(width)
      || typeof height !== "number" || !Number.isFinite(height)
    ) return false;
    if (x < 0 || y < 0 || width < 4 || height < 4) return false;
    if (x + width > 100 || y + height > 100) return false;
  }
  return true;
}

function validStartingEquipment(value: unknown) {
  if (!Array.isArray(value)) return false;
  const slotKeys = new Set<string>();
  for (const assignment of value) {
    if (!object(assignment)) return false;
    if (typeof assignment.slotKey !== "string" || !assignment.slotKey.trim() || slotKeys.has(assignment.slotKey)) return false;
    if (typeof assignment.itemId !== "string" || !assignment.itemId) return false;
    slotKeys.add(assignment.slotKey);
  }
  return true;
}

export const inventoryMutationValidator: WorkerMutationValidator = {
  types: ["item.upsert", "bodyBackground.upsert", "bodyBackground.delete", "bodyBackground.starting"],
  validate(operation) {
    if (operation.type === "item.upsert") {
      if (!object(operation.item)) return "Item is invalid.";
      const item = operation.item;
      if (item.startingQuantity !== undefined && (
        !Number.isInteger(item.startingQuantity) || (item.startingQuantity as number) < 0
      )) {
        return "Item starting quantity must be a non-negative integer.";
      }
      if (item.equipmentSlotKeys !== undefined && !validStringArray(item.equipmentSlotKeys)) {
        return "Item equipment slot keys are invalid.";
      }
      if (item.equippedStorage !== undefined && item.equippedStorage !== "inventory" && item.equippedStorage !== "slot") {
        return "Item equipped storage policy is invalid.";
      }
      return validateOperationCapabilities(item) ?? validateHooks(item);
    }

    if (operation.type === "bodyBackground.upsert") {
      if (!object(operation.background)) return "Body type is invalid.";
      if (typeof operation.background.id !== "string" || !operation.background.id) return "Body type id is required.";
      if (typeof operation.background.name !== "string" || !operation.background.name.trim()) return "Body type name is required.";
      if (typeof operation.background.assetPath !== "string") return "Body type asset path is invalid.";
      if (operation.background.slots !== undefined && !validBodySlots(operation.background.slots)) return "Body type slots are invalid.";
      if (operation.background.startingEquipment !== undefined && !validStartingEquipment(operation.background.startingEquipment)) {
        return "Body type starting equipment is invalid.";
      }
      return null;
    }

    if (operation.type === "bodyBackground.delete") {
      return typeof operation.id === "string" && operation.id ? null : "Body type id is required.";
    }

    if (operation.type === "bodyBackground.starting") {
      return operation.id === null || typeof operation.id === "string"
        ? null
        : "Starting body type id is invalid.";
    }

    return null;
  },
};
