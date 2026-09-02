import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { addNewDefaultItemsToPlayState, createStartingInventory, findFirstPlacement } from "./runtime";

export function initializeInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  return createStartingInventory(snapshot, { ...state, inventory: [], inventoryPositions: {} });
}

export function reconcileInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const legacy = state as PlayState & { inventoryPositions?: Record<string, { x: number; y: number }>; inventory?: Array<any> };
  const inventory = (legacy.inventory ?? []).map((entry) => ({ instanceId: entry.instanceId, itemId: entry.itemId, quantity: entry.quantity, state: { ...(entry.state ?? {}) } }));
  let nextState: PlayState = { ...state, inventory, inventoryPositions: { ...(legacy.inventoryPositions ?? {}) } };
  if (snapshot.inventoryPresentation.mode === "grid") {
    for (const entry of inventory) {
      if (nextState.inventoryPositions[entry.instanceId]) continue;
      const old = (legacy.inventory ?? []).find((candidate) => candidate.instanceId === entry.instanceId);
      const oldPosition = old && Number.isFinite(old.x) && Number.isFinite(old.y) ? { x: old.x, y: old.y } : null;
      const placement = oldPosition ?? findFirstPlacement(snapshot, nextState, entry.itemId);
      if (placement) nextState = { ...nextState, inventoryPositions: { ...nextState.inventoryPositions, [entry.instanceId]: placement } };
    }
  }
  return nextState;
}

export function reconcileInventoryPlayStateAfterProjectChange(previousSnapshot: ProjectSnapshot, nextSnapshot: ProjectSnapshot, state: PlayState) {
  return reconcileInventoryPlayState(nextSnapshot, addNewDefaultItemsToPlayState(previousSnapshot, nextSnapshot, state));
}
