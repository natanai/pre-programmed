import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { addInventoryItem, addNewDefaultItemsToPlayState } from "./runtime";

export function initializeInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  let nextState: PlayState = { ...state, inventory: [] };
  for (const item of snapshot.items) {
    nextState = addInventoryItem(snapshot, nextState, item.id, item.startingQuantity ?? 0);
  }
  return nextState;
}

/**
 * Reconcile Inventory when authored project data changes. Existing inventory is
 * preserved; only newly introduced item definitions contribute their authored
 * starting quantity.
 */
export function reconcileInventoryPlayStateAfterProjectChange(
  previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
): PlayState {
  return addNewDefaultItemsToPlayState(previousSnapshot, nextSnapshot, state);
}
