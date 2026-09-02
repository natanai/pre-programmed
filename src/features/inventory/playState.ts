import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { addNewDefaultItemsToPlayState, createStartingInventory, findFirstPlacement } from "./runtime";

export function initializeInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  return createStartingInventory(snapshot, { ...state, inventory: [], inventoryPositions: {} });
}

export function reconcileInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const validItemIds = new Set(snapshot.items.map((item) => item.id));
  const inventory = state.inventory
    .filter((entry) => validItemIds.has(entry.itemId))
    .map((entry) => ({ ...entry, state: { ...entry.state } }));
  const validInstanceIds = new Set(inventory.map((entry) => entry.instanceId));
  let inventoryPositions = Object.fromEntries(
    Object.entries(state.inventoryPositions).filter(([instanceId]) => validInstanceIds.has(instanceId)),
  );
  let nextState: PlayState = { ...state, inventory, inventoryPositions };

  if (snapshot.inventoryPresentation.mode === "grid") {
    for (const entry of inventory) {
      if (nextState.inventoryPositions[entry.instanceId]) continue;
      const placement = findFirstPlacement(snapshot, nextState, entry.itemId);
      if (placement) {
        inventoryPositions = { ...nextState.inventoryPositions, [entry.instanceId]: placement };
        nextState = { ...nextState, inventoryPositions };
      }
    }
  } else if (Object.keys(inventoryPositions).length) {
    nextState = { ...nextState, inventoryPositions: {} };
  }

  return nextState;
}

export function reconcileInventoryPlayStateAfterProjectChange(
  previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
) {
  return reconcileInventoryPlayState(
    nextSnapshot,
    addNewDefaultItemsToPlayState(previousSnapshot, nextSnapshot, state),
  );
}
