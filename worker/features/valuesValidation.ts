import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

export const valuesMutationValidator: WorkerMutationValidator = {
  types: ["value.upsert", "derivedValue.upsert"],
  validate(operation) {
    if (!object(operation.definition)) return null;
    const definition = operation.definition;
    if (operation.type === "value.upsert") {
      if (definition.timeRate !== undefined && (typeof definition.timeRate !== "number" || !Number.isFinite(definition.timeRate))) return "Value time change must be a finite number.";
      if (definition.timeUnit !== undefined && !["second", "minute", "hour"].includes(String(definition.timeUnit))) return "Value time unit is invalid.";
      if (!["number", "boolean", "string"].includes(String(definition.valueType))) return "Value type is invalid.";
    }
    if (operation.type === "derivedValue.upsert") {
      if (!object(definition.source) || typeof definition.source.provider !== "string" || typeof definition.source.metric !== "string") return "Derived values require a source provider and metric.";
    }
    return validateOperationCapabilities(definition) ?? validateHooks(definition);
  },
};
