import { WORKER_FEATURE_PERSISTENCE } from "../features/catalog";
import type { WorkerMigration } from "./migrationContract";
import { executeSqlScript, MIGRATION_SCRIPTS as HISTORICAL_MIGRATIONS } from "./migrations";
import {
  restorePreReplacementStateInventorySchema,
  STATE_INVENTORY_ROLLBACK_ID,
  STATE_INVENTORY_ROLLBACK_NAME,
} from "./rollbackStateInventory";

/**
 * Canonical runtime migration owner.
 *
 * Migrations 1-12 predate the feature-persistence architecture and are retained
 * unchanged as historical schema facts. New feature schema changes belong to
 * the owning Worker feature contribution and are composed here.
 */
function migrationPlan(): WorkerMigration[] {
  const contributed = WORKER_FEATURE_PERSISTENCE.flatMap((feature) => feature.migrations ?? []);
  const plan = [...HISTORICAL_MIGRATIONS, ...contributed].sort((left, right) => left.id - right.id);
  const ids = new Set<number>();
  for (const migration of plan) {
    if (ids.has(migration.id)) throw new Error(`Duplicate schema migration id ${migration.id}.`);
    ids.add(migration.id);
  }
  return plan;
}

let ready: Promise<void> | null = null;

async function migrate(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const applied = await db.prepare("SELECT id FROM schema_migrations ORDER BY id").all<{ id: number }>();
  const appliedIds = new Set(applied.results.map((row) => row.id));

  // Production briefly ran the replacement State/Inventory migrations through
  // schema 27. A raw source rollback would leave the restored runtime pointing at
  // tables those migrations removed. Recover that known upgraded shape once,
  // before the old feature persistence loads. Fresh installs never enter here.
  if (appliedIds.has(27) && !appliedIds.has(STATE_INVENTORY_ROLLBACK_ID)) {
    await restorePreReplacementStateInventorySchema(db);
    await db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)")
      .bind(STATE_INVENTORY_ROLLBACK_ID, STATE_INVENTORY_ROLLBACK_NAME)
      .run();
    appliedIds.add(STATE_INVENTORY_ROLLBACK_ID);
  }

  for (const migration of migrationPlan()) {
    if (appliedIds.has(migration.id)) continue;
    await executeSqlScript(db, migration.sql);
    await db.prepare("INSERT INTO schema_migrations (id, name) VALUES (?, ?)")
      .bind(migration.id, migration.name)
      .run();
  }
}

export function ensureSchema(db: D1Database) {
  if (!ready) {
    ready = migrate(db).catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
