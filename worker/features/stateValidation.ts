import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function validPresentation(value: unknown) {
  if (value === null || value === undefined) return true;
  if (!object(value)) return false;
  return typeof value.groupId === "string"
    && typeof value.order === "number"
    && Number.isFinite(value.order)
    && object(value.visibleWhen)
    && typeof value.visibleWhen.type === "string";
}

export const stateMutationValidator: WorkerMutationValidator = {
  types: ["variable.upsert", "computed.upsert", "stateGroup.upsert", "stateGroup.delete"],
  validate(operation) {
    if (operation.type === "stateGroup.delete") {
      return typeof operation.id === "string" && operation.id ? null : "State group id is required.";
    }

    if (operation.type === "stateGroup.upsert") {
      if (!object(operation.group)) return "State group payload is invalid.";
      if (typeof operation.group.id !== "string" || !operation.group.id) return "State group id is required.";
      if (typeof operation.group.label !== "string" || !operation.group.label.trim()) return "State group name is required.";
      if (typeof operation.group.order !== "number" || !Number.isFinite(operation.group.order)) return "State group order must be finite.";
      if (!object(operation.group.visibleWhen) || typeof operation.group.visibleWhen.type !== "string") return "State group visibility condition is invalid.";
      return null;
    }

    if (!object(operation.definition)) return null;
    const definition = operation.definition;
    if (!validPresentation(definition.playerPresentation)) return "Player presentation metadata is invalid.";

    if (operation.type === "variable.upsert") {
      if (definition.timeRate !== undefined && (typeof definition.timeRate !== "number" || !Number.isFinite(definition.timeRate))) {
        return "Variable time change must be a finite number.";
      }
      if (definition.timeUnit !== undefined && !["second", "minute", "hour"].includes(String(definition.timeUnit))) {
        return "Variable time unit is invalid.";
      }
    }

    return validateOperationCapabilities(definition) ?? validateHooks(definition);
  },
};
