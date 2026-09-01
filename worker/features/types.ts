import type { MutationOperation, ProjectSnapshot } from "../../src/engine/project/model";
import type { WorkerMigration } from "../db/migrationContract";

export type WorkerFeaturePersistence = {
  id: string;
  /** Future schema changes owned by this feature. Historical migrations remain immutable. */
  migrations?: readonly WorkerMigration[];
  /** Lower values clear first. Use when foreign-key dependencies require reset ordering. */
  resetOrder?: number;
  /** Lower values restore first. Use when another feature references this feature's rows. */
  restoreOrder?: number;
  /** Load this feature's flat project-data slice. */
  load(db: D1Database): Promise<Partial<ProjectSnapshot>>;
  /** Return statements when this feature owns the mutation, otherwise null. */
  mutationStatements(db: D1Database, operation: MutationOperation): D1PreparedStatement[] | null;
  /** Clear feature-owned durable project rows before snapshot restore. */
  resetStatements(db: D1Database): D1PreparedStatement[];
  /** Convert a snapshot slice back into ordinary project mutations for restore. */
  restoreOperations(snapshot: ProjectSnapshot): MutationOperation[];
};
