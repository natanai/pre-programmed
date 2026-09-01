import { mediaFeaturePersistence } from "./mediaPersistence";
import type { WorkerFeaturePersistence } from "./types";

/**
 * Explicit Worker persistence composition root.
 *
 * Features move here as their read/write/reset/restore ownership is extracted
 * from the transitional central project store.
 */
export const WORKER_FEATURE_PERSISTENCE: readonly WorkerFeaturePersistence[] = [
  mediaFeaturePersistence,
];
