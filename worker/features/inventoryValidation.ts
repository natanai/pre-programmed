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
    for (const field of ["x", "y", "width", "height"] as const) {
      if (typeof slot[field] !== "number" || !Number.isFinite(slot[field])) return false;
    }
    if (slot.x < 0 || slot.y < 0 || slot.width < 4 || slot.height < 4) return false;
    if (slot.x + slot.width > 100 || slot.y + slot.height > 100) return false;
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
      return validateOperationCapabilities(item) ?? validateHooks(item);
    }

    if (operation.type === "bodyBackground.upsert") {
      if (!object(operation.background)) return "Body type is invalid.";
      if (typeof operation.background.id !== "string" || !operation.background.id) return "Body type id is required.";
      if (typeof operation.background.name !== "string" || !operation.background.name.trim()) return "Body type name is required.";
      if (typeof operation.background.assetPath !== "string") return "Body type asset path is invalid.";
      if (operation.background.slots !== undefined && !validBodySlots(operation.background.slots)) return "Body type slots are invalid.";
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
