import { commandsProjectSettingsValid } from "./commandsValidation";
import { equipmentMutationValidator } from "./equipmentValidation";
import { validateNewEquipmentReferences } from "./equipmentIntegrity";
import { inventoryMutationValidator } from "./inventoryValidation";
import { validateNewInventoryReferences } from "./inventoryIntegrity";
import { mediaMutationValidator } from "./mediaValidation";
import { narrativeMutationValidator } from "./narrativeValidation";
import { statusMutationValidator } from "./statusValidation";
import { validateNewStatusReferences } from "./statusIntegrity";
import type { WorkerMutationValidator } from "./validationTypes";
import { valuesMutationValidator } from "./valuesValidation";
import { worldMutationValidator } from "./worldValidation";

export const WORKER_MUTATION_VALIDATORS: readonly WorkerMutationValidator[] = [
  narrativeMutationValidator,
  worldMutationValidator,
  valuesMutationValidator,
  statusMutationValidator,
  inventoryMutationValidator,
  equipmentMutationValidator,
  mediaMutationValidator,
];
export const WORKER_MUTATION_VALIDATOR_BY_TYPE: Readonly<Record<string, WorkerMutationValidator>> = Object.fromEntries(WORKER_MUTATION_VALIDATORS.flatMap((validator) => validator.types.map((type) => [type, validator] as const)));
export const WORKER_PROJECT_SETTINGS_VALIDATORS: readonly ((value: unknown) => boolean)[] = [commandsProjectSettingsValid];
export const WORKER_PROJECT_INTEGRITY_VALIDATORS = [validateNewInventoryReferences, validateNewEquipmentReferences, validateNewStatusReferences] as const;
