export {
  nodeLocationMode,
  resolveActiveNodeLocationContext,
} from "./sceneContext";

export type { ActiveNodeLocationContext } from "./sceneContext";

import type { GameNode } from "./model";
import { normalizeNodeSceneContext } from "./sceneContext";

/** Compatibility projection while existing callers move to the complete Scene contract. */
export function normalizeNodeLocationContext(node: GameNode): GameNode {
  return normalizeNodeSceneContext(node);
}
