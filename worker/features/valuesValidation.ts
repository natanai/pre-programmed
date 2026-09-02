import { object, validateHooks, validateOperationCapabilities } from "./validationHelpers";
import type { WorkerMutationValidator } from "./validationTypes";

function validInitialValue(valueType: unknown, value: unknown) {
  if (value === null) return true;
  if (valueType === "number") return typeof value === "number" && Number.isFinite(value);
  if (valueType === "boolean") return typeof value === "boolean";
  if (valueType === "string") return typeof value === "string";
  return false;
}

export const valuesMutationValidator: WorkerMutationValidator = {
  types: ["value.upsert", "derivedValue.upsert"],
  validate(operation) {
    if (!object(operation.definition)) return "Value definition is invalid.";
    const definition = operation.definition;
    if (typeof definition.id !== "string" || !definition.id) return "Value id is required.";
    if (typeof definition.key !== "string" || !definition.key.trim()) return "Value key is required.";
    if (typeof definition.label !== "string") return "Value label is invalid.";

    if (operation.type === "value.upsert") {
      if (!["number", "boolean", "string"].includes(String(definition.valueType))) return "Value type is invalid.";
      if (!validInitialValue(definition.valueType, definition.initialValue)) return "Value initial value does not match its type.";
      if (definition.timeRate !== undefined && (typeof definition.timeRate !== "number" || !Number.isFinite(definition.timeRate))) {
        return "Value time change must be a finite number.";
      }
      if (definition.timeUnit !== undefined && !["second", "minute", "hour"].includes(String(definition.timeUnit))) {
        return "Value time unit is invalid.";
      }
    }

    if (operation.type === "derivedValue.upsert") {
      if (!object(definition.source)) return "Derived values require a source provider and metric.";
      if (typeof definition.source.provider !== "string" || !definition.source.provider.trim()) return "Derived value provider is required.";
      if (typeof definition.source.metric !== "string" || !definition.source.metric.trim()) return "Derived value metric is required.";
      if (!["raw", "integer", "seconds"].includes(String(definition.format))) return "Derived value format is invalid.";
    }

    return validateOperationCapabilities(definition) ?? validateHooks(definition);
  },
};
