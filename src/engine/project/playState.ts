import { initializeCommandsPlayState } from "../../features/commands/playState";
import { initializeEquipmentPlayState, reconcileEquipmentPlayState } from "../../features/equipment/playState";
import { initializeInventoryPlayState, reconcileInventoryPlayState, reconcileInventoryPlayStateAfterProjectChange } from "../../features/inventory/playState";
import { initializeNarrativePlayState } from "../../features/narrative/playState";
import { initializeValuesPlayState, reconcileValuesPlayState } from "../../features/values/playState";
import { PRIMARY_POSSESSION_SERVICES } from "../possessions/servicesCatalog";
import type { AuthorBookmark, PlayState, ProjectSnapshot } from "./model";

export function createEmptyPlayState(snapshot: ProjectSnapshot, now = Date.now()): PlayState {
  let state = { sessionStartedAt: now } as PlayState;
  state = initializeNarrativePlayState(snapshot, state);
  state = initializeValuesPlayState(snapshot, state, now);
  state = initializeCommandsPlayState(state);
  state = initializeInventoryPlayState(snapshot, state);
  state = initializeEquipmentPlayState(snapshot, state, PRIMARY_POSSESSION_SERVICES);
  return state;
}

export function reconcilePlayState(snapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  let nextState = reconcileValuesPlayState(snapshot, state, now);
  nextState = reconcileInventoryPlayState(snapshot, nextState);
  nextState = reconcileEquipmentPlayState(snapshot, nextState, PRIMARY_POSSESSION_SERVICES);
  return nextState;
}

export function resumePlayState(snapshot: ProjectSnapshot, state: PlayState, savedAt: string | number, now = Date.now()): PlayState {
  const savedAtTime = typeof savedAt === "number" ? savedAt : Date.parse(savedAt);
  const elapsedAtSave = Number.isFinite(savedAtTime) ? Math.max(0, savedAtTime - state.sessionStartedAt) : 0;
  return reconcilePlayState(snapshot, { ...structuredClone(state), sessionStartedAt: now - elapsedAtSave, valueTimeUpdatedAt: now }, now);
}

export function reconcilePlayStateAfterProjectChange(previousSnapshot: ProjectSnapshot, nextSnapshot: ProjectSnapshot, state: PlayState, now = Date.now()): PlayState {
  let nextState = reconcileValuesPlayState(nextSnapshot, state, now);
  nextState = reconcileInventoryPlayStateAfterProjectChange(previousSnapshot, nextSnapshot, nextState);
  nextState = reconcileEquipmentPlayState(nextSnapshot, nextState, PRIMARY_POSSESSION_SERVICES);
  return nextState;
}

export function resumeAuthorBookmark(snapshot: ProjectSnapshot, bookmark: AuthorBookmark, now = Date.now()): PlayState {
  return resumePlayState(snapshot, { ...bookmark.playState, currentNodeId: bookmark.nodeId, traversal: [...bookmark.traversal] }, bookmark.createdAt, now);
}
