import { inventoryFeaturePersistence } from "./inventoryPersistence";
import { mediaFeaturePersistence } from "./mediaPersistence";
import { narrativeFeaturePersistence } from "./narrativePersistence";
import { stateFeaturePersistence } from "./statePersistence";
import type { WorkerFeaturePersistence } from "./types";
import { worldFeaturePersistence } from "./worldPersistence";

/**
 * Explicit Worker persistence composition root.
 *
 * Feature modules own their D1 read/write/reset/restore semantics. This catalog
 * is the only place the core Worker needs to know which feature persistence
 * contributions are installed and how their cross-feature FK dependencies are
 * ordered.
 *
 * Narrative must reset before World because node_context can reference World
 * entities. World must restore before Narrative for the inverse reason.
 */
export const WORKER_FEATURE_PERSISTENCE: readonly WorkerFeaturePersistence[] = [
  { ...narrativeFeaturePersistence, resetOrder: 0, restoreOrder: 20 },
  { ...worldFeaturePersistence, resetOrder: 10, restoreOrder: 0 },
  { ...stateFeaturePersistence, resetOrder: 10, restoreOrder: 10 },
  { ...inventoryFeaturePersistence, resetOrder: 10, restoreOrder: 10 },
  { ...mediaFeaturePersistence, resetOrder: 10, restoreOrder: 10 },
];

export function workerFeaturesForReset() {
  return [...WORKER_FEATURE_PERSISTENCE].sort((left, right) =>
    (left.resetOrder ?? 100) - (right.resetOrder ?? 100) || left.id.localeCompare(right.id));
}

export function workerFeaturesForRestore() {
  return [...WORKER_FEATURE_PERSISTENCE].sort((left, right) =>
    (left.restoreOrder ?? 100) - (right.restoreOrder ?? 100) || left.id.localeCompare(right.id));
}

/** Feature-owned authored data that lives outside the ordinary ProjectSnapshot. */
export async function collectWorkerPortableFeatureData(db: D1Database) {
  const entries = await Promise.all(WORKER_FEATURE_PERSISTENCE.map(async (feature) => [
    feature.id,
    feature.exportPortableData ? await feature.exportPortableData(db) : undefined,
  ] as const));
  return Object.fromEntries(entries.filter((entry) => entry[1] !== undefined)) as Record<string, unknown>;
}

/** Rebuild out-of-snapshot authored data through each feature's own restore contract. */
export function workerPortableFeatureRestoreStatements(db: D1Database, featureData: Record<string, unknown>) {
  return WORKER_FEATURE_PERSISTENCE.flatMap((feature) =>
    feature.restorePortableDataStatements
      ? feature.restorePortableDataStatements(db, featureData[feature.id])
      : []);
}
