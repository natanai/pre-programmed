import type { WorkerMutationValidator } from "./validationTypes";

export const mediaMutationValidator: WorkerMutationValidator = {
  types: ["synth.upsert"],
  validate() {
    // The existing Worker contract has no additional Synth payload constraints.
    return null;
  },
};
