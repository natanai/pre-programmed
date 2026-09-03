import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { Value } from "../../engine/rules/model";
import type { ComputedDefinition } from "./model";

export function inventorySlotsUsed(snapshot: ProjectSnapshot, state: PlayState) {
  const byId = new Map(snapshot.items.map((item) => [item.id, item]));
  return state.inventory.reduce((total, entry) => {
    const item = byId.get(entry.itemId);
    return total + (item ? item.width * item.height : 0);
  }, 0);
}

export function readComputedValue(
  definition: ComputedDefinition,
  snapshot: ProjectSnapshot,
  state: PlayState,
  now = Date.now(),
): Value {
  switch (definition.source) {
    case "elapsed_seconds":
      return Math.max(0, (now - state.sessionStartedAt) / 1000);
    case "commands_entered":
      return state.commandsEntered;
    case "inventory_slots_used":
      return inventorySlotsUsed(snapshot, state);
    case "visited_nodes":
      return new Set(state.visitedNodeIds).size;
  }
}

export function readNamedValue(
  key: string,
  snapshot: ProjectSnapshot,
  state: PlayState,
  now = Date.now(),
): Value {
  if (Object.prototype.hasOwnProperty.call(state.values, key)) return state.values[key];
  const computed = snapshot.computedValues.find((definition) => definition.key === key);
  return computed ? readComputedValue(computed, snapshot, state, now) : null;
}
