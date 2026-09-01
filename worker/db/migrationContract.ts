export type WorkerMigration = {
  /** Globally unique monotonically increasing schema migration id. */
  id: number;
  name: string;
  sql: string;
};
