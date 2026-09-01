import { initializeCommandsPlayState } from "../../features/commands/playState";
import {
  initializeInventoryPlayState,
  reconcileInventoryPlayStateAfterProjectChange,
} from "../../features/inventory/playState";
import { initializeNarrativePlayState } from "../../features/narrative/playState";
import { initializeStatePlayState, reconcileStatePlayState } from "../../features/state/playState";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "./model";

/**
 * Compose the initial play state from feature-owned lifecycle contributions.
 *
 * Runtime shape intentionally remains source-compatible during the modularity
 * migration; this function is the explicit composition root for installed
 * play-state slices.
 */
export function createEmptyPlayState(snapshot: ProjectSnapshot, now = Date.now()): PlayState {
  let state = { sessionStartedAt: now } as PlayState;
  state = initializeNarrativePlayState(snapshot, state);
  state = initializeStatePlayState(snapshot, state, now);
  state = initializeCommandsPlayState(state);
  state = initializeInventoryPlayState(snapshot, state);
  return state;
}

/** Reconcile durable play state through the features that currently require it. */
export function reconcilePlayState(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  return reconcileStatePlayState(snapshot, state, now);
}

/**
 * Reconcile feature-owned play state after authored project data changes.
 * App/session code should call this composition root rather than naming the
 * feature whose state needs repair or initialization.
 */
export function reconcilePlayStateAfterProjectChange(
  previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
  now = Date.now(),
): PlayState {
  let nextState = reconcilePlayState(nextSnapshot, state, now);
  nextState = reconcileInventoryPlayStateAfterProjectChange(previousSnapshot, nextSnapshot, nextState);
  return nextState;
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
