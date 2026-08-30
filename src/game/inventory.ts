import type {
  InventoryEntry,
  ItemDefinition,
  PlayState,
  ProjectSnapshot,
} from "./model";

export const INVENTORY_COLUMNS = 10;
export const INVENTORY_ROWS = 6;

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
