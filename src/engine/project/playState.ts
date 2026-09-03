import { initializeCommandsPlayState } from "../../features/commands/playState";
import {
  initializeInventoryPlayState,
  reconcileInventoryPlayState,
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
  let nextState = reconcileStatePlayState(snapshot, state, now);
  nextState = reconcileInventoryPlayState(snapshot, nextState);
  return nextState;
}

/**
 * Resume a durable play state without counting time spent outside the active
 * play session. Feature-owned reconciliation then repairs data that changed in
 * a compatible authored project revision.
 */
export function resumePlayState(
  snapshot: ProjectSnapshot,
  state: PlayState,
  savedAt: string | number,
  now = Date.now(),
): PlayState {
  const savedAtTime = typeof savedAt === "number" ? savedAt : Date.parse(savedAt);
  const elapsedAtSave = Number.isFinite(savedAtTime)
    ? Math.max(0, savedAtTime - state.sessionStartedAt)
    : 0;
  return reconcilePlayState(snapshot, {
    ...structuredClone(state),
    sessionStartedAt: now - elapsedAtSave,
    variableTimeUpdatedAt: now,
  }, now);
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
  return resumePlayState(snapshot, {
    ...bookmark.playState,
    currentNodeId: bookmark.nodeId,
    traversal: [...bookmark.traversal],
  }, bookmark.createdAt, now);
}
