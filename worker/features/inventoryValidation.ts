import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

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
      return validateOperationCapabilities(item) ?? validateHooks(item);
    }

    if (operation.type === "bodyBackground.upsert") {
      if (!object(operation.background)) return "Body background is invalid.";
      if (typeof operation.background.id !== "string" || !operation.background.id) return "Body background id is required.";
      if (typeof operation.background.name !== "string" || !operation.background.name.trim()) return "Body background name is required.";
      if (typeof operation.background.assetPath !== "string") return "Body background asset path is invalid.";
      return null;
    }

    if (operation.type === "bodyBackground.delete") {
      return typeof operation.id === "string" && operation.id ? null : "Body background id is required.";
    }

    if (operation.type === "bodyBackground.starting") {
      return operation.id === null || typeof operation.id === "string"
        ? null
        : "Starting body background id is invalid.";
    }

    return null;
  },
};
