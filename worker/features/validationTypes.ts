export type WorkerMutationValidator = {
  types: readonly string[];
  validate(operation: Record<string, unknown>): string | null;
};
