import { object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const equipmentMutationValidator: WorkerMutationValidator = {
  types: ["bodyType.upsert", "bodyType.delete", "bodyType.starting", "equipmentRule.upsert"],
  validate(operation) {
    if (operation.type === "bodyType.upsert") {
      if (!object(operation.bodyType) || typeof operation.bodyType.id !== "string" || !Array.isArray(operation.bodyType.slots)) return "Body type is invalid.";
    }
    if (operation.type === "equipmentRule.upsert") {
      if (!object(operation.rule) || typeof operation.rule.itemId !== "string" || !["inventory", "slot"].includes(String(operation.rule.storage))) return "Equipment rule is invalid.";
    }
    return null;
  },
};
