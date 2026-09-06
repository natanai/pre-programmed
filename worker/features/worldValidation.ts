import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const worldMutationValidator: WorkerMutationValidator = {
  types: ["entity.upsert", "entity.delete"],
  validate(operation) {
    if (operation.type === "entity.delete") {
      return typeof operation.id === "string" && operation.id.trim()
        ? null
        : "World entity id is invalid.";
    }
    if (!object(operation.entity)) return null;
    const entity = operation.entity;
    if (entity.type !== undefined && !["character", "location"].includes(String(entity.type))) {
      return "World entity type is invalid.";
    }
    return validateOperationCapabilities(entity) ?? validateHooks(entity);
  },
};
