import { object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const statusMutationValidator: WorkerMutationValidator = {
  types: ["statusGroup.upsert", "statusEntry.upsert"],
  validate(operation) {
    if (operation.type === "statusGroup.upsert") {
      if (!object(operation.group) || typeof operation.group.id !== "string" || typeof operation.group.key !== "string") return "Status groups require an id and key.";
    }
    if (operation.type === "statusEntry.upsert") {
      if (!object(operation.entry) || !object(operation.entry.source)) return "Status entries require a source.";
      if (!["value", "derived"].includes(String(operation.entry.source.kind)) || typeof operation.entry.source.id !== "string") return "Status entry source is invalid.";
    }
    return null;
  },
};
