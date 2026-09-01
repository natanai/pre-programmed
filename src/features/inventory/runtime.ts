import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { BodySlotDefinition, InventoryEntry, ItemDefinition } from "./model";

export const INVENTORY_COLUMNS = 10;
export const INVENTORY_ROWS = 6;

function itemForEntry(snapshot: ProjectSnapshot, entry: InventoryEntry) {
  return snapshot.items.find((item) => item.id === entry.itemId);
}

export function activeBodyType(snapshot: ProjectSnapshot, state: PlayState) {
  return (snapshot.bodyBackgrounds ?? []).find((bodyType) => bodyType.id === state.bodyBackgroundId);
}

export function activeBodySlots(snapshot: ProjectSnapshot, state: PlayState): BodySlotDefinition[] {
  return activeBodyType(snapshot, state)?.slots ?? [];
}

export function itemCanEquipToSlot(item: ItemDefinition, slot: BodySlotDefinition) {
  const allowedKeys = item.equipmentSlotKeys ?? [];
  return allowedKeys.length === 0 || allowedKeys.includes(slot.key);
}

export function compatibleBodySlots(snapshot: ProjectSnapshot, state: PlayState, item: ItemDefinition) {
  return activeBodySlots(snapshot, state).filter((slot) => itemCanEquipToSlot(item, slot));
}

export function equipInventoryEntry(
  snapshot: ProjectSnapshot,
  state: PlayState,
  instanceId: string,
  slotKey: string,
): PlayState {
  const entry = state.inventory.find((candidate) => candidate.instanceId === instanceId);
  const item = snapshot.items.find((candidate) => candidate.id === entry?.itemId);
  const slot = activeBodySlots(snapshot, state).find((candidate) => candidate.key === slotKey);
  if (!entry || !item || !slot || !itemCanEquipToSlot(item, slot)) return state;
  return {
    ...state,
    inventory: state.inventory.map((candidate) => {
      if (candidate.instanceId === instanceId) return { ...candidate, equippedSlotKey: slot.key };
      if (candidate.equippedSlotKey === slot.key) return { ...candidate, equippedSlotKey: null };
      return candidate;
    }),
  };
}

export function unequipInventoryEntry(state: PlayState, instanceId: string): PlayState {
  return {
    ...state,
    inventory: state.inventory.map((candidate) => candidate.instanceId === instanceId
      ? { ...candidate, equippedSlotKey: null }
      : candidate),
  };
}

/** Remove equipment assignments whose stable slot key no longer exists on the current body type. */
export function reconcileEquippedItems(snapshot: ProjectSnapshot, state: PlayState): PlayState {
  const slotKeys = new Set(activeBodySlots(snapshot, state).map((slot) => slot.key));
  return {
    ...state,
    inventory: (state.inventory ?? []).map((entry) => entry.equippedSlotKey && !slotKeys.has(entry.equippedSlotKey)
      ? { ...entry, equippedSlotKey: null }
      : entry),
  };
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
      equippedSlotKey: null,
      state: { ...item.initialState },
    });
    remaining -= accepted;
  }
  return { ...state, inventory };
}

export function addNewDefaultItemsToPlayState(
  previousSnapshot: ProjectSnapshot,
  nextSnapshot: ProjectSnapshot,
  state: PlayState,
) {
  const previousItemIds = new Set(previousSnapshot.items.map((item) => item.id));
  let nextState = state;
  for (const item of nextSnapshot.items) {
    if (previousItemIds.has(item.id)) continue;
    const currentQuantity = nextState.inventory
      .filter((entry) => entry.itemId === item.id)
      .reduce((total, entry) => total + entry.quantity, 0);
    const missingQuantity = Math.max(0, (item.startingQuantity ?? 0) - currentQuantity);
    nextState = addInventoryItem(nextSnapshot, nextState, item.id, missingQuantity);
  }
  return nextState;
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
