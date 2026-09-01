import { commandsProjectSettingsValid } from "./commandsValidation";
import { inventoryMutationValidator } from "./inventoryValidation";
import { mediaMutationValidator } from "./mediaValidation";
import { narrativeMutationValidator } from "./narrativeValidation";
import { stateMutationValidator } from "./stateValidation";
import type { WorkerMutationValidator } from "./validationTypes";
import { worldMutationValidator } from "./worldValidation";

export const WORKER_MUTATION_VALIDATORS: readonly WorkerMutationValidator[] = [
  narrativeMutationValidator,
  worldMutationValidator,
  stateMutationValidator,
  inventoryMutationValidator,
  mediaMutationValidator,
];

export const WORKER_MUTATION_VALIDATOR_BY_TYPE: Readonly<Record<string, WorkerMutationValidator>> =
  Object.fromEntries(WORKER_MUTATION_VALIDATORS.flatMap((validator) =>
    validator.types.map((type) => [type, validator] as const)));

/** Feature-owned validators for slices stored inside the core project.settings mutation. */
export const WORKER_PROJECT_SETTINGS_VALIDATORS: readonly ((value: unknown) => boolean)[] = [
  commandsProjectSettingsValid,
];
