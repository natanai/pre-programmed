import { addInventoryItem } from "./inventory";
import { ALWAYS as ALWAYS_RULE, type Condition } from "../engine/rules/model";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "../engine/project/model";

/**
 * Compatibility facade for the prototype's existing imports.
 *
 * Feature contracts now live with their owning feature. Runtime code can move
 * to those boundaries incrementally without a flag-day import rewrite.
 */
export * from "../engine/rules/model";
export * from "../engine/project/model";
export * from "../features/inventory/model";
export * from "../features/media/model";
export * from "../features/narrative/model";
export * from "../features/operations/model";
export * from "../features/state/model";
export * from "../features/world/model";

export function createEmptyPlayState(snapshot: ProjectSnapshot, now = Date.now()): PlayState {
  let state: PlayState = {
    currentNodeId: snapshot.startNodeId,
    traversal: [snapshot.startNodeId],
    values: Object.fromEntries(snapshot.variables.map((definition) => [definition.key, definition.initialValue])),
    attempts: {},
    inventory: [],
    visitedNodeIds: [snapshot.startNodeId],
    interactionVisibility: {},
    sessionStartedAt: now,
    variableTimeUpdatedAt: now,
    commandsEntered: 0,
    lastCommand: "",
  };
  for (const item of snapshot.items) {
    state = addInventoryItem(snapshot, state, item.id, item.startingQuantity ?? 0);
  }
  return state;
}

export function reconcilePlayState(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  return {
    ...state,
    variableTimeUpdatedAt: state.variableTimeUpdatedAt ?? now,
    values: {
      ...Object.fromEntries(snapshot.variables.map((definition) => [definition.key, definition.initialValue])),
      ...state.values,
    },
  };
}

export function resumeAuthorBookmark(snapshot: ProjectSnapshot, bookmark: AuthorBookmark, now = Date.now()): PlayState {
  const savedAt = Date.parse(bookmark.createdAt);
  const elapsedAtSave = Number.isFinite(savedAt)
    ? Math.max(0, savedAt - bookmark.playState.sessionStartedAt)
    : 0;
  return reconcilePlayState(snapshot, {
    ...structuredClone(bookmark.playState),
    currentNodeId: bookmark.nodeId,
    traversal: [...bookmark.traversal],
    sessionStartedAt: now - elapsedAtSave,
    variableTimeUpdatedAt: now,
  }, now);
}

export function nextNodeNumber(snapshot: ProjectSnapshot) {
  return snapshot.nodes.reduce((maximum, node) => Math.max(maximum, node.nodeNumber), 0) + 1;
}

export function makeId() {
  return crypto.randomUUID();
}

export const ALWAYS: Condition = ALWAYS_RULE;
