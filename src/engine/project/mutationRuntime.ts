import type { MutationOperation, ProjectSnapshot } from "./model";

/** Apply one mutation payload to the already-cloned optimistic snapshot. */
export type MutationHandler = (
  snapshot: ProjectSnapshot,
  operation: MutationOperation,
) => void;
