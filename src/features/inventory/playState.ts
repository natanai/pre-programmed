import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { addInventoryItem, addNewDefaultItemsToPlayState, reconcileEquippedItems } from "./runtime";

function bodyTypes(snapshot: ProjectSnapshot) {
  return snapshot.bodyBackgrounds ?? [];
}

function validStartingBodyTypeId(snapshot: ProjectSnapshot) {
  const id = snapshot.startingBodyBackgroundId ?? null;
  return id && bodyTypes(snapshot).some((bodyType) => bodyType.id === id) ? id : null;
}

export function initializeInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  let nextState: PlayState = {
    ...state,
    inventory: [],
    bodyBackgroundId: validStartingBodyTypeId(snapshot),
  };
  for (const item of snapshot.items) {
    nextState = addInventoryItem(snapshot, nextState, item.id, item.startingQuantity ?? 0);
  }
  return reconcileEquippedItems(snapshot, nextState);
}

/** Normalize Inventory state loaded from older bookmarks/saves or changed project data. */
export function reconcileInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const hasBodyTypeState = Object.prototype.hasOwnProperty.call(state, "bodyBackgroundId");
  const selectedId = state.bodyBackgroundId ?? null;
  const selectedStillExists = selectedId
    ? bodyTypes(snapshot).some((bodyType) => bodyType.id === selectedId)
    : false;
  const bodyBackgroundId = !hasBodyTypeState
    ? validStartingBodyTypeId(snapshot)
    : selectedId === null
      ? null
      : selectedStillExists
        ? selectedId
        : validStartingBodyTypeId(snapshot);

  return reconcileEquippedItems(snapshot, {
    ...state,
    inventory: (state.inventory ?? []).map((entry) => ({
      ...entry,
      equippedSlotKey: entry.equippedSlotKey ?? null,
    })),
    bodyBackgroundId,
  });
}

/**
 * Reconcile Inventory when authored project data changes. Existing inventory is
 * preserved; only newly introduced item definitions contribute their authored
 * starting quantity. The current body type is preserved while it still exists;
 * an explicitly cleared body type stays clear. Equipment remains in stable slot
 * keys that still exist and is unequipped when a new body type removes a slot.
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
