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
 * contributions are installed in this build.
 */
export const WORKER_FEATURE_PERSISTENCE: readonly WorkerFeaturePersistence[] = [
  narrativeFeaturePersistence,
  worldFeaturePersistence,
  stateFeaturePersistence,
  inventoryFeaturePersistence,
  mediaFeaturePersistence,
];
