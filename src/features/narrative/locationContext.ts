export {
  nodeLocationMode,
  resolveActiveNodeLocationContext,
} from "./sceneContext";

export type { ActiveNodeLocationContext } from "./sceneContext";

import type { GameNode } from "./model";
import { normalizeNodeContext } from "./sceneContext";

/** Compatibility projection for callers that only own Location behavior. */
export function normalizeNodeLocationContext(node: GameNode): GameNode {
  return normalizeNodeContext(node);
}
