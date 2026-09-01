import { commandsProjectSettingsValid } from "./features/commandsValidation";
import { WORKER_MUTATION_VALIDATOR_BY_TYPE } from "./features/validationCatalog";
import { object } from "./features/validationHelpers";

const CORE_OPERATION_TYPES = new Set([
  "project.settings",
  "bookmark.upsert",
  "bookmark.delete",
]);

function projectSettingsValid(value: unknown) {
  return object(value)
    && typeof value.terminalPrompt === "string"
    && value.terminalPrompt.length >= 1
    && value.terminalPrompt.length <= 32
    && commandsProjectSettingsValid(value);
}

export function validateMutationBody(value: unknown) {
  if (!object(value)) return "Invalid body.";
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) {
    return "expectedRevision must be a non-negative integer.";
  }
  if (typeof value.description !== "string" || value.description.length > 240) {
    return "description must be no longer than 240 characters.";
  }
  if (!Array.isArray(value.operations) || value.operations.length < 1 || value.operations.length > 50) {
    return "operations must contain between one and fifty operations.";
  }

  for (const operation of value.operations) {
    if (!object(operation) || typeof operation.type !== "string") return "Unknown mutation operation.";

    const featureValidator = WORKER_MUTATION_VALIDATOR_BY_TYPE[operation.type];
    if (!CORE_OPERATION_TYPES.has(operation.type) && !featureValidator) {
      return "Unknown mutation operation.";
    }

    if (operation.type === "project.settings") {
      if (!projectSettingsValid(operation.settings)) return "Project settings are invalid.";
      continue;
    }

    const featureError = featureValidator?.validate(operation);
    if (featureError) return featureError;
  }
  return null;
}
