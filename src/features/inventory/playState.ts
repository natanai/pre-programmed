import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { addInventoryItem } from "./runtime";

export function initializeInventoryPlayState(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  let nextState: PlayState = { ...state, inventory: [] };
  for (const item of snapshot.items) {
    nextState = addInventoryItem(snapshot, nextState, item.id, item.startingQuantity ?? 0);
  }
  return nextState;
}
