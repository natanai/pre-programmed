/**
 * Compatibility facade for the prototype's existing imports.
 *
 * Feature contracts now live with their owning feature. Runtime code can move
 * to those boundaries incrementally without a flag-day import rewrite.
 */
export * from "../engine/rules/model";
export * from "../engine/project/model";
export { makeId } from "../engine/project/id";
export {
  createEmptyPlayState,
  reconcilePlayState,
  reconcilePlayStateAfterProjectChange,
  resumeAuthorBookmark,
} from "../engine/project/playState";
export * from "../features/inventory/model";
export * from "../features/media/model";
export * from "../features/narrative/model";
export { nextNodeNumber } from "../features/narrative/nodeNumber";
export * from "../features/operations/model";
export * from "../features/state/model";
export * from "../features/world/model";
