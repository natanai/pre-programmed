import { conditionValid, object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
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
    // Historical projects store string aliases; the current Character editor
    // preserves alias conditions in { name, condition? } entries. Validate both
    // representations through the existing shared condition contract.
    if (entity.aliases !== undefined && (!Array.isArray(entity.aliases) || entity.aliases.some((alias) =>
      typeof alias !== "string" && (!object(alias)
        || typeof alias.name !== "string"
        || !alias.name.trim()
        || (alias.condition !== undefined && !conditionValid(alias.condition)))))) {
      return "World entity aliases are invalid.";
    }
    if (entity.startingNameSelection !== undefined
      && entity.startingNameSelection !== "first"
      && entity.startingNameSelection !== "random") {
      return "Character starting name selection is invalid.";
    }
    return validateOperationCapabilities(entity) ?? validateHooks(entity);
  },
};
