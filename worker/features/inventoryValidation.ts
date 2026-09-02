import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const inventoryMutationValidator: WorkerMutationValidator = {
  types: ["item.upsert", "item.delete", "itemInventoryLayout.upsert", "inventoryPresentation.upsert"],
  validate(operation) {
    if (operation.type === "item.upsert") {
      if (!object(operation.item)) return "Item is invalid.";
      if (typeof operation.item.assetId !== "string") return "Item asset reference is invalid.";
      if (!Number.isInteger(operation.item.startingQuantity) || Number(operation.item.startingQuantity) < 0) return "Item starting quantity must be a non-negative integer.";
      if (typeof operation.item.stackable !== "boolean" || !Number.isInteger(operation.item.maxStack) || Number(operation.item.maxStack) < 1) return "Item stacking configuration is invalid.";
      return validateOperationCapabilities(operation.item) ?? validateHooks(operation.item);
    }
    if (operation.type === "item.delete") return typeof operation.id === "string" && operation.id ? null : "Item id is required.";
    if (operation.type === "itemInventoryLayout.upsert") {
      if (!object(operation.layout) || typeof operation.layout.itemId !== "string") return "Item layout is invalid.";
      if (!Number.isInteger(operation.layout.width) || !Number.isInteger(operation.layout.height) || Number(operation.layout.width) < 1 || Number(operation.layout.height) < 1) return "Item grid footprint must use positive whole numbers.";
    }
    if (operation.type === "inventoryPresentation.upsert") {
      if (!object(operation.presentation) || !["list", "grid"].includes(String(operation.presentation.mode))) return "Inventory presentation is invalid.";
      if (operation.presentation.mode === "grid" && (!Number.isInteger(operation.presentation.columns) || !Number.isInteger(operation.presentation.rows) || Number(operation.presentation.columns) < 1 || Number(operation.presentation.rows) < 1)) return "Inventory grid dimensions must use positive whole numbers.";
    }
    return null;
  },
};
