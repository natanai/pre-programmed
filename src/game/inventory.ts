import { evaluateCondition } from "./conditions";
import type {
  InventoryEntry,
  InventoryOperation,
  ItemDefinition,
  PlayState,
  ProjectSnapshot,
} from "./model";

export const INVENTORY_COLUMNS = 10;
export const INVENTORY_ROWS = 6;

export type InventoryOperationRequest = {
  operation: InventoryOperation;
  instanceId: string;
  target?: { x: number; y: number };
};

export type InventoryOperationResult = {
  eventKey: string;
  attempt: number;
  accepted: boolean;
  responseText: string;
  effects: import("./model").Effect[];
  state: PlayState;
};

function itemForEntry(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  return snapshot.items.find((item) => item.id === entry.itemId);
}

export function occupiedCells(
  snapshot: ProjectSnapshot,
  entries: InventoryEntry[],
  ignoreInstanceId?: string,
) {
  const occupied = new Set<string>();
  for (const entry of entries) {
    if (entry.instanceId === ignoreInstanceId) continue;
    const item = itemForEntry(snapshot, entry);
    if (!item) continue;
    for (let y = entry.y; y < entry.y + item.height; y += 1) {
      for (let x = entry.x; x < entry.x + item.width; x += 1) occupied.add(`${x}:${y}`);
    }
  }
  return occupied;
}

export function canPlaceItem(
  snapshot: ProjectSnapshot,
  entries: InventoryEntry[],
  item: ItemDefinition,
  x: number,
  y: number,
  ignoreInstanceId?: string,
) {
  if (x < 0 || y < 0 || x + item.width > INVENTORY_COLUMNS || y + item.height > INVENTORY_ROWS) {
    return false;
  }
  const occupied = occupiedCells(snapshot, entries, ignoreInstanceId);
  for (let cellY = y; cellY < y + item.height; cellY += 1) {
    for (let cellX = x; cellX < x + item.width; cellX += 1) {
      if (occupied.has(`${cellX}:${cellY}`)) return false;
    }
  }
  return true;
}

export function findFirstPlacement(snapshot: ProjectSnapshot, state: PlayState, item: ItemDefinition) {
  for (let y = 0; y < INVENTORY_ROWS; y += 1) {
    for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
      if (canPlaceItem(snapshot, state.inventory, item, x, y)) return { x, y };
    }
  }
  return null;
}

export function addInventoryItem(
  snapshot: ProjectSnapshot,
  state: PlayState,
  itemId: string,
  quantity = 1,
): PlayState {
  const item = snapshot.items.find((candidate) => candidate.id === itemId);
  if (!item || quantity <= 0) return state;
  const inventory = state.inventory.map((entry) => ({ ...entry, state: { ...entry.state } }));
  let remaining = Math.floor(quantity);

  if (item.stackable) {
    for (const entry of inventory) {
      if (entry.itemId !== item.id || entry.quantity >= item.maxStack) continue;
      const accepted = Math.min(remaining, item.maxStack - entry.quantity);
      entry.quantity += accepted;
      remaining -= accepted;
      if (remaining === 0) return { ...state, inventory };
    }
  }

  while (remaining > 0) {
    const provisional = { ...state, inventory };
    const placement = findFirstPlacement(snapshot, provisional, item);
    if (!placement) break;
    const accepted = item.stackable ? Math.min(remaining, item.maxStack) : 1;
    inventory.push({
      instanceId: crypto.randomUUID(),
      itemId: item.id,
      quantity: accepted,
      ...placement,
      state: { ...item.initialState },
    });
    remaining -= accepted;
  }
  return { ...state, inventory };
}

export function removeInventoryItem(state: PlayState, itemId: string, quantity = 1): PlayState {
  let remaining = Math.max(0, Math.floor(quantity));
  const inventory: InventoryEntry[] = [];
  for (const original of state.inventory) {
    const entry = { ...original, state: { ...original.state } };
    if (entry.itemId !== itemId || remaining === 0) {
      inventory.push(entry);
      continue;
    }
    const removed = Math.min(remaining, entry.quantity);
    entry.quantity -= removed;
    remaining -= removed;
    if (entry.quantity > 0) inventory.push(entry);
  }
  return { ...state, inventory };
}

export function attemptInventoryOperation(
  snapshot: ProjectSnapshot,
  state: PlayState,
  request: InventoryOperationRequest,
): InventoryOperationResult {
  const entry = state.inventory.find((candidate) => candidate.instanceId === request.instanceId);
  const item = entry && itemForEntry(snapshot, entry);
  const eventKey = `inventory:${entry?.itemId ?? "missing"}:${request.operation}`;
  const attempt = (state.attempts[eventKey] ?? 0) + 1;
  let nextState: PlayState = {
    ...state,
    attempts: { ...state.attempts, [eventKey]: attempt },
  };
  if (!entry || !item) {
    return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState };
  }

  const hook = [...item.hooks]
    .filter((candidate) => candidate.operation === request.operation)
    .sort((left, right) => left.order - right.order)
    .find((candidate) => evaluateCondition(candidate.condition, { snapshot, state: nextState, eventKey }));

  if (hook) {
    let accepted = hook.success;
    if (hook.success && request.operation === "move" && request.target) {
      accepted = canPlaceItem(
        snapshot,
        nextState.inventory,
        item,
        request.target.x,
        request.target.y,
        entry.instanceId,
      );
      if (accepted) {
        nextState = {
          ...nextState,
          inventory: nextState.inventory.map((candidate) =>
            candidate.instanceId === entry.instanceId
              ? { ...candidate, x: request.target!.x, y: request.target!.y }
              : candidate,
          ),
        };
      }
    }
    if (hook.success && request.operation === "remove") {
      nextState = {
        ...nextState,
        inventory: nextState.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId),
      };
    }
    return {
      eventKey,
      attempt,
      accepted,
      responseText: hook.responseText,
      effects: hook.effects,
      state: nextState,
    };
  }

  if (request.operation === "inspect") {
    return { eventKey, attempt, accepted: true, responseText: item.description, effects: [], state: nextState };
  }

  if (request.operation === "move" && request.target) {
    const valid = canPlaceItem(
      snapshot,
      nextState.inventory,
      item,
      request.target.x,
      request.target.y,
      entry.instanceId,
    );
    if (valid) {
      nextState = {
        ...nextState,
        inventory: nextState.inventory.map((candidate) =>
          candidate.instanceId === entry.instanceId
            ? { ...candidate, x: request.target!.x, y: request.target!.y }
            : candidate,
        ),
      };
    }
    return { eventKey, attempt, accepted: valid, responseText: "", effects: [], state: nextState };
  }

  if (request.operation === "remove" && item.removable) {
    nextState = {
      ...nextState,
      inventory: nextState.inventory.filter((candidate) => candidate.instanceId !== entry.instanceId),
    };
    return { eventKey, attempt, accepted: true, responseText: "", effects: [], state: nextState };
  }

  return { eventKey, attempt, accepted: false, responseText: "", effects: [], state: nextState };
}
