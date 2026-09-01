import { MUTATION_HANDLERS } from "./mutationCatalog";
import type { MutationOperation, ProjectSnapshot } from "./model";

/**
 * Deterministically apply authored mutation operations to a project snapshot.
 *
 * Engine Project owns the optimistic transformation loop and composes installed
 * mutation handlers. Feature modules own the payloads and transformations for
 * their own project data. Persistence decides where mutations are stored.
 */
export function applyOperations(snapshot: ProjectSnapshot, operations: MutationOperation[]) {
  const next = structuredClone(snapshot);
  for (const operation of operations) {
    MUTATION_HANDLERS[operation.type]?.(next, operation);
  }
  return next;
}
