import { initializeCommandsPlayState } from "../../features/commands/playState";
import { initializeNarrativePlayState } from "../../features/narrative/playState";
import { initializeStatePlayState, reconcileStatePlayState } from "../../features/state/playState";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "./model";

/** Compose initial play state from installed feature lifecycle contributions. */
export function createEmptyPlayState(snapshot: ProjectSnapshot, now = Date.now()): PlayState {
  let state = { sessionStartedAt: now } as PlayState;
  state = initializeNarrativePlayState(snapshot, state);
  state = initializeStatePlayState(snapshot, state, now);
  state = initializeCommandsPlayState(state);
  return state;
}

export function reconcilePlayState(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  return reconcileStatePlayState(snapshot, state, now);
}

export function reconcilePlayStateAfterProjectChange(
  _previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
  now = Date.now(),
): PlayState {
  return reconcilePlayState(nextSnapshot, state, now);
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
