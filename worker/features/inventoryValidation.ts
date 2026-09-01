import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const inventoryMutationValidator: WorkerMutationValidator = {
  types: ["item.upsert"],
  validate(operation) {
    if (!object(operation.item)) return null;
    const item = operation.item;
    if (item.startingQuantity !== undefined && (
      !Number.isInteger(item.startingQuantity) || (item.startingQuantity as number) < 0
    )) {
      return "Item starting quantity must be a non-negative integer.";
    }
    return validateOperationCapabilities(item) ?? validateHooks(item);
  },
};
