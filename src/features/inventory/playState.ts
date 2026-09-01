import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { addInventoryItem, addNewDefaultItemsToPlayState } from "./runtime";

function bodyBackgrounds(snapshot: ProjectSnapshot) {
  return snapshot.bodyBackgrounds ?? [];
}

function validStartingBodyBackgroundId(snapshot: ProjectSnapshot) {
  const id = snapshot.startingBodyBackgroundId ?? null;
  return id && bodyBackgrounds(snapshot).some((background) => background.id === id) ? id : null;
}

export function initializeInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  let nextState: PlayState = {
    ...state,
    inventory: [],
    bodyBackgroundId: validStartingBodyBackgroundId(snapshot),
  };
  for (const item of snapshot.items) {
    nextState = addInventoryItem(snapshot, nextState, item.id, item.startingQuantity ?? 0);
  }
  return nextState;
}

/** Normalize Inventory state loaded from older bookmarks/saves or changed project data. */
export function reconcileInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const selectedId = state.bodyBackgroundId ?? null;
  const selectedStillExists = selectedId
    ? bodyBackgrounds(snapshot).some((background) => background.id === selectedId)
    : false;
  return {
    ...state,
    inventory: state.inventory ?? [],
    bodyBackgroundId: selectedStillExists ? selectedId : validStartingBodyBackgroundId(snapshot),
  };
}

/**
 * Reconcile Inventory when authored project data changes. Existing inventory is
 * preserved; only newly introduced item definitions contribute their authored
 * starting quantity. The current body background is preserved while it still
 * exists, otherwise the authored starting background is restored.
 */
export function reconcileInventoryPlayStateAfterProjectChange(
  previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
): PlayState {
  return reconcileInventoryPlayState(
    nextSnapshot,
    addNewDefaultItemsToPlayState(previousSnapshot, nextSnapshot, state),
  );
}
