import { conditionValid, object } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const statusMutationValidator: WorkerMutationValidator = {
  types: ["statusGroup.upsert", "statusEntry.upsert"],
  validate(operation) {
    if (operation.type === "statusGroup.upsert") {
      if (!object(operation.group)) return "Status group is invalid.";
      const group = operation.group;
      if (typeof group.id !== "string" || !group.id) return "Status group id is required.";
      if (typeof group.key !== "string" || !group.key.trim()) return "Status group key is required.";
      if (typeof group.label !== "string") return "Status group label is invalid.";
      if (!Number.isInteger(group.order)) return "Status group order must be a whole number.";
      if (!conditionValid(group.visibleWhen)) return "Status group visibility condition is invalid.";
      return null;
    }

    if (operation.type === "statusEntry.upsert") {
      if (!object(operation.entry)) return "Status entry is invalid.";
      const entry = operation.entry;
      const source = entry.source;
      if (!object(source)) return "Status entry source is invalid.";
      if (typeof entry.id !== "string" || !entry.id) return "Status entry id is required.";
      if (typeof entry.groupId !== "string" || !entry.groupId) return "Status entry group is required.";
      if (typeof entry.label !== "string") return "Status entry label is invalid.";
      if (!Number.isInteger(entry.order)) return "Status entry order must be a whole number.";
      if (!["value", "derived"].includes(String(source.kind))) return "Status entry source kind is invalid.";
      if (typeof source.id !== "string" || !source.id) return "Status entry source is required.";
      if (!conditionValid(entry.visibleWhen)) return "Status entry visibility condition is invalid.";
      return null;
    }

    return null;
  },
};
