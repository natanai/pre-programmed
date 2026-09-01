import type { MutationOperation, ProjectSnapshot } from "../../src/engine/project/model";

export type WorkerFeaturePersistence = {
  id: string;
  /** Load this feature's flat project-data slice. */
  load(db: D1Database): Promise<Partial<ProjectSnapshot>>;
  /** Return statements when this feature owns the mutation, otherwise null. */
  mutationStatements(db: D1Database, operation: MutationOperation): D1PreparedStatement[] | null;
  /** Clear feature-owned durable project rows before snapshot restore. */
  resetStatements(db: D1Database): D1PreparedStatement[];
  /** Convert a snapshot slice back into ordinary project mutations for restore. */
  restoreOperations(snapshot: ProjectSnapshot): MutationOperation[];
};
