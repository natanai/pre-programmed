import { inventoryFeaturePersistence } from "./inventoryPersistence";
import { mediaFeaturePersistence } from "./mediaPersistence";
import { stateFeaturePersistence } from "./statePersistence";
import type { WorkerFeaturePersistence } from "./types";
import { worldFeaturePersistence } from "./worldPersistence";

/**
 * Explicit Worker persistence composition root.
 *
 * Features move here as their read/write/reset/restore ownership is extracted
 * from the transitional central project store.
 */
export const WORKER_FEATURE_PERSISTENCE: readonly WorkerFeaturePersistence[] = [
  worldFeaturePersistence,
  stateFeaturePersistence,
  inventoryFeaturePersistence,
  mediaFeaturePersistence,
];
