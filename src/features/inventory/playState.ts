import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { InventoryEntry } from "./model";
import { addNewDefaultItemsToPlayState, createStartingInventory, reconcileEquippedItems } from "./runtime";

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
  return reconcileEquippedItems(snapshot, createStartingInventory(snapshot, nextState));
}

function normalizeInventoryEntry(entry: InventoryEntry): InventoryEntry {
  // Old local bookmarks/play sessions stored one equippedSlotKey. Read it once
  // at the boundary and immediately normalize to the new assignment model.
  const legacy = entry as InventoryEntry & { equippedSlotKey?: string | null };
  const { equippedSlotKey, ...current } = legacy;
  const equipment = current.equipment ?? (equippedSlotKey
    ? { anchorSlotKey: equippedSlotKey, occupiedSlotKeys: [equippedSlotKey] }
    : null);
  return {
    ...current,
    equipment: equipment
      ? { ...equipment, occupiedSlotKeys: [...equipment.occupiedSlotKeys] }
      : null,
  };
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
    inventory: (state.inventory ?? []).map(normalizeInventoryEntry),
    bodyBackgroundId,
  });
}

/**
 * Reconcile Inventory when authored project data changes. Existing inventory is
 * preserved; only newly introduced item definitions contribute their authored
 * starting quantity. The current body type is preserved while it still exists;
 * an explicitly cleared body type stays clear. Equipment placements are
 * recomputed against the active body's stable slot keys.
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
