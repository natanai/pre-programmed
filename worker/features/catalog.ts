import { equipmentFeaturePersistence } from "./equipmentPersistence";
import { inventoryFeaturePersistence } from "./inventoryPersistence";
import { mediaFeaturePersistence } from "./mediaPersistence";
import { narrativeFeaturePersistence } from "./narrativePersistence";
import { statusFeaturePersistence } from "./statusPersistence";
import type { WorkerFeaturePersistence } from "./types";
import { valuesFeaturePersistence } from "./valuesPersistence";
import { worldFeaturePersistence } from "./worldPersistence";

export const WORKER_FEATURE_PERSISTENCE: readonly WorkerFeaturePersistence[] = [
  { ...narrativeFeaturePersistence, resetOrder: 0, restoreOrder: 30 },
  { ...worldFeaturePersistence, resetOrder: 10, restoreOrder: 0 },
  { ...valuesFeaturePersistence, resetOrder: 10, restoreOrder: 10 },
  { ...statusFeaturePersistence, resetOrder: 5, restoreOrder: 20 },
  inventoryFeaturePersistence,
  equipmentFeaturePersistence,
  { ...mediaFeaturePersistence, resetOrder: 10, restoreOrder: 10 },
];
export function workerFeaturesForReset() { return [...WORKER_FEATURE_PERSISTENCE].sort((left, right) => (left.resetOrder ?? 100) - (right.resetOrder ?? 100) || left.id.localeCompare(right.id)); }
export function workerFeaturesForRestore() { return [...WORKER_FEATURE_PERSISTENCE].sort((left, right) => (left.restoreOrder ?? 100) - (right.restoreOrder ?? 100) || left.id.localeCompare(right.id)); }
