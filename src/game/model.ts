import { ALWAYS as ALWAYS_RULE, type Condition } from "../engine/rules/model";
import type { ProjectSnapshot } from "../engine/project/model";

/**
 * Compatibility facade for the prototype's existing imports.
 *
 * Feature contracts now live with their owning feature. Runtime code can move
 * to those boundaries incrementally without a flag-day import rewrite.
 */
export * from "../engine/rules/model";
export * from "../engine/project/model";
export {
  createEmptyPlayState,
  reconcilePlayState,
  reconcilePlayStateAfterProjectChange,
  resumeAuthorBookmark,
} from "../engine/project/playState";
export * from "../features/inventory/model";
export * from "../features/media/model";
export * from "../features/narrative/model";
export * from "../features/operations/model";
export * from "../features/state/model";
export * from "../features/world/model";

export function nextNodeNumber(snapshot: ProjectSnapshot) {
  return snapshot.nodes.reduce((maximum, node) => Math.max(maximum, node.nodeNumber), 0) + 1;
}

export function makeId() {
  return crypto.randomUUID();
}

export const ALWAYS: Condition = ALWAYS_RULE;
