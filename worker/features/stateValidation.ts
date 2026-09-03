import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const stateMutationValidator: WorkerMutationValidator = {
  types: ["variable.upsert", "computed.upsert"],
  validate(operation) {
    if (!object(operation.definition)) return null;
    const definition = operation.definition;

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
