import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { InventoryEntry, ItemDefinition, ItemInventoryLayout } from "./model";

export function itemLayout(snapshot: ProjectSnapshot, itemId: string): ItemInventoryLayout {
  return snapshot.itemInventoryLayouts.find((layout) => layout.itemId === itemId) ?? { itemId, width: 1, height: 1 };
}

function itemForEntry(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  return snapshot.items.find((item) => item.id === entry.itemId);
}

export function occupiedCells(snapshot: ProjectSnapshot, state: PlayState, ignoreInstanceId?: string) {
  const occupied = new Set<string>();
  if (snapshot.inventoryPresentation.mode !== "grid") return occupied;
  for (const entry of state.inventory) {
    if (entry.instanceId === ignoreInstanceId) continue;
    const position = state.inventoryPositions[entry.instanceId];
    if (!position) continue;
    const layout = itemLayout(snapshot, entry.itemId);
    for (let y = position.y; y < position.y + layout.height; y += 1) {
      for (let x = position.x; x < position.x + layout.width; x += 1) occupied.add(`${x}:${y}`);
    }
  }
  return occupied;
}

export function canPlaceItem(snapshot: ProjectSnapshot, state: PlayState, itemId: string, x: number, y: number, ignoreInstanceId?: string) {
  if (snapshot.inventoryPresentation.mode !== "grid") return true;
  const layout = itemLayout(snapshot, itemId);
  if (x < 0 || y < 0 || x + layout.width > snapshot.inventoryPresentation.columns || y + layout.height > snapshot.inventoryPresentation.rows) return false;
  const occupied = occupiedCells(snapshot, state, ignoreInstanceId);
  for (let cellY = y; cellY < y + layout.height; cellY += 1) {
    for (let cellX = x; cellX < x + layout.width; cellX += 1) if (occupied.has(`${cellX}:${cellY}`)) return false;
  }
  return true;
}

export function findFirstPlacement(snapshot: ProjectSnapshot, state: PlayState, itemId: string) {
  if (snapshot.inventoryPresentation.mode !== "grid") return null;
  for (let y = 0; y < snapshot.inventoryPresentation.rows; y += 1) {
    for (let x = 0; x < snapshot.inventoryPresentation.columns; x += 1) if (canPlaceItem(snapshot, state, itemId, x, y)) return { x, y };
  }
  return null;
}

export function removeFromPrimaryContainer(state: PlayState, instanceId: string): PlayState {
  if (!state.inventoryPositions[instanceId]) return state;
  const inventoryPositions = { ...state.inventoryPositions };
  delete inventoryPositions[instanceId];
  return { ...state, inventoryPositions };
}

export function returnToPrimaryContainer(snapshot: ProjectSnapshot, state: PlayState, instanceId: string) {
  if (snapshot.inventoryPresentation.mode !== "grid") return { accepted: true, state };
  if (state.inventoryPositions[instanceId]) return { accepted: true, state };
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!entry) return { accepted: false, state };
  const placement = findFirstPlacement(snapshot, state, entry.itemId);
  return placement
    ? { accepted: true, state: { ...state, inventoryPositions: { ...state.inventoryPositions, [instanceId]: placement } } }
    : { accepted: false, state };
}

export const INVENTORY_POSSESSION_SERVICES = { removeFromPrimaryContainer, returnToPrimaryContainer } as const;

export function moveInventoryEntry(snapshot: ProjectSnapshot, state: PlayState, instanceId: string, x: number, y: number) {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  if (!entry || !canPlaceItem(snapshot, state, entry.itemId, x, y, instanceId)) return state;
  return { ...state, inventoryPositions: { ...state.inventoryPositions, [instanceId]: { x, y } } };
}

export function addInventoryItem(snapshot: ProjectSnapshot, state: PlayState, itemId: string, quantity = 1): PlayState {
  const item = snapshot.items.find((candidate) => candidate.id === itemId);
  if (!item || quantity <= 0) return state;
  const inventory = state.inventory.map((entry) => ({ ...entry, state: { ...entry.state } }));
  let nextState: PlayState = { ...state, inventory, inventoryPositions: { ...state.inventoryPositions } };
  let remaining = Math.floor(quantity);

  if (item.stackable) {
    for (const entry of inventory) {
      if (entry.itemId !== item.id || entry.quantity >= item.maxStack) continue;
      const accepted = Math.min(remaining, item.maxStack - entry.quantity);
      entry.quantity += accepted;
      remaining -= accepted;
      if (remaining === 0) return nextState;
    }
  }

  while (remaining > 0) {
    const placement = snapshot.inventoryPresentation.mode === "grid" ? findFirstPlacement(snapshot, nextState, item.id) : null;
    if (snapshot.inventoryPresentation.mode === "grid" && !placement) break;
    const accepted = item.stackable ? Math.min(remaining, item.maxStack) : 1;
    const instanceId = crypto.randomUUID();
    inventory.push({ instanceId, itemId: item.id, quantity: accepted, state: { ...item.initialState } });
    if (placement) nextState.inventoryPositions[instanceId] = placement;
    remaining -= accepted;
  }
  return nextState;
}

export function removeInventoryItem(state: PlayState, itemId: string, quantity = 1): PlayState {
  let remaining = Math.max(0, Math.floor(quantity));
  const inventory: InventoryEntry[] = [];
  const inventoryPositions = { ...state.inventoryPositions };
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
    else delete inventoryPositions[entry.instanceId];
  }
  return { ...state, inventory, inventoryPositions };
}

export function createStartingInventory(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  let nextState: PlayState = { ...state, inventory: [], inventoryPositions: {} };
  for (const item of snapshot.items) nextState = addInventoryItem(snapshot, nextState, item.id, Math.max(0, item.startingQuantity ?? 0));
  return nextState;
}

export function addNewDefaultItemsToPlayState(previousSnapshot: ProjectSnapshot, nextSnapshot: ProjectSnapshot, state: PlayState) {
  const previousItemIds = new Set(previousSnapshot.items.map((item) => item.id));
  let nextState = state;
  for (const item of nextSnapshot.items) {
    if (previousItemIds.has(item.id)) continue;
    const current = nextState.inventory.filter((entry) => entry.itemId === item.id).reduce((total, entry) => total + entry.quantity, 0);
    nextState = addInventoryItem(nextSnapshot, nextState, item.id, Math.max(0, item.startingQuantity - current));
  }
  return nextState;
}

export function itemDefinition(snapshot: ProjectSnapshot, state: PlayState, instanceId: string): ItemDefinition | undefined {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  return snapshot.items.find((item) => item.id === entry?.itemId);
}
